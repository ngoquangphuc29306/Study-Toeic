# EasyTOEIC — SRS Implementation Contract

**Document version**: 3.0
**Updated**: 2026-08-05
**Status**: Current implementation reference

Tài liệu này mô tả behavior đang chạy trong source code và Supabase migrations. Không dùng tài liệu này để suy ra một thuật toán tương lai.

## 1. Authoritative rating flow

Rating được thực hiện bởi:

```text
FlashcardMode
  → AppPage.handleUpdateProgress()
  → services/vocabService.updateUserProgress()
  → services/progressService.submitVocabularyRating()
  → Supabase RPC submit_vocabulary_rating
```

RPC `submit_vocabulary_rating` là nguồn sự thật duy nhất cho:

- `new_status`;
- `next_review_at`;
- `interval_hours`;
- `review_count`;
- `again_count`;
- review log và timestamp server.

Client không tự tính lại lịch SRS sau khi RPC trả về. `lib/srs/applyRatingResult.ts` chỉ patch các field do `RatingResult` trả về vào vocabulary hiện tại.

## 2. States và ratings

```typescript
type LearningStatus = 'new' | 'learning' | 'mastered';
type SrsRating = 'again' | 'hard' | 'good' | 'easy' | 'mastered';
```

- `new`: chưa có progress review.
- `learning`: đang trong chu kỳ học/ôn tập.
- `mastered`: người dùng đánh dấu đã thuộc; không còn lịch review theo thời gian.

Các nút UI Again/Hard/Good/Easy giữ mapping hiện tại. `mastered` là action riêng dùng để đánh dấu hoàn tất.

## 3. Current scheduling behavior

Server dùng timestamp authoritative từ `clock_timestamp()` trong RPC.

| Rating | Status sau rating | `interval_hours` | `next_review_at` | Counter |
|---|---|---:|---|---|
| Again | `learning` | `0` | `null` | `again_count + 1`, `review_count + 1` |
| Hard | `learning` | `6` nếu interval hiện tại bằng 0, ngược lại `current × 2` | server time + interval | `review_count + 1` |
| Good | `learning` | `24` nếu interval hiện tại bằng 0, ngược lại `current × 3` | server time + interval | `review_count + 1` |
| Easy | `learning` | `72` nếu interval hiện tại bằng 0, ngược lại `current × 4` | server time + interval | `review_count + 1` |
| Mastered | `mastered` | giữ interval hiện tại | `null` | `review_count + 1` |

Again là queue-based relearning, không phải lịch 1 phút. Card được requeue trong session hiện tại bởi `lib/session/queueTransition.ts`.

## 4. Due condition và queue

Điều kiện một vocabulary đến hạn trong `features/review-reminder/types.ts` là:

```text
status !== 'mastered'
AND next_review_at khác null
AND next_review_at <= thời điểm hiện tại
```

Queue session được quản lý trong `FlashcardMode.tsx`:

- `Again`: card được đưa lại sau gap 5 card; duplicate pending entry được loại bỏ trước khi reinsert.
- `Hard`, `Good`, `Easy`, `Mastered`: tăng `currentIndex`.
- Session hoàn tất khi index kế tiếp vượt quá queue hiện tại.
- Snapshot queue/index được lưu trong `sessionStorage` theo user.
- Snapshot được khôi phục khi context topic/status khớp; clear khi session hoàn tất hoặc người dùng restart.

Queue transition không thay đổi SRS schedule trên server.

## 5. Idempotency contract

Mỗi logical rating action tạo một UUID idempotency key và giữ nguyên key khi retry.

### Success

RPC trả `status: 'success'` hoặc `status: 'already_processed'` đều được coi là rating thành công.

`already_processed` trả lại result snapshot đã lưu trước đó; client dùng snapshot này và không tạo review log mới.

### Retryable failure

Network timeout hoặc lỗi transport không chứng minh rằng server chưa ghi rating. Client giữ pending action và retry bằng cùng key.

### Permanent contract failure

- `idempotency_conflict`: key đã được dùng với vocabulary/rating payload khác; không retry cùng key.
- `legacy_result_unavailable`: review log cũ không có result snapshot đủ để khôi phục deterministic result; không retry cùng key.

Hai lỗi này clear pending action trong memory và `sessionStorage`, không advance queue, và action mới phải tạo key mới.

RPC dùng transaction advisory lock theo user/idempotency key, kiểm tra payload reuse và lưu result snapshot cùng review log. Progress update và review log nằm trong cùng transaction.

## 6. Mutation và aggregate refresh

Rating mutation và derived-data refresh là hai giai đoạn độc lập:

```text
submit RPC
  → validate RatingResult
  → patch local vocabulary
  → transition queue
  → lưu session snapshot
  → refresh metrics/week activity best-effort
```

Nếu dashboard metrics hoặc week activity refresh lỗi:

- rating vẫn được coi là thành công;
- không rollback vocabulary;
- không đưa card về queue;
- giữ aggregate snapshot thành công gần nhất;
- retry nền hoặc retry ở focus/resume tiếp theo.

`loadAppDataSnapshot()` tải core data (collections, topics, vocabularies) và tách aggregate data. `Promise.allSettled()` được dùng cho aggregate để một lỗi metrics không làm mất core snapshot.

## 7. Local reconciliation

`applyRatingResult()` chỉ nhận `RatingResult` đã validate từ RPC và patch:

- `status` từ `new_status`;
- `next_review_at`;
- `interval_hours`;
- `review_count`;
- `again_count`;
- `is_difficult = again_count >= 5`.

Không có client-side scheduler nào được dùng để ghi đè các field này sau mutation.

## 8. Deferred algorithm work

Các thay đổi sau chưa tồn tại trong implementation hiện tại và không được mô tả như behavior đang chạy:

- ease factor;
- SM-2 hoặc FSRS;
- interval cap;
- automatic mastery promotion;
- relearning step theo thời gian cho Again;
- trạng thái mới ngoài `new`, `learning`, `mastered`.

Nếu thay đổi SRS, phải có decision riêng và regression verification với cùng vocabulary state/rating.

## 9. Related implementation files

- `services/progressService.ts` — `RatingResult`, RPC response validation, idempotency errors.
- `services/vocabService.ts` — authenticated mutation wrapper.
- `app/app/page.tsx` — mutation boundary, local patch, aggregate refresh.
- `components/FlashcardMode.tsx` — rating action, pending lifecycle, queue/session commit.
- `lib/srs/applyRatingResult.ts` — authoritative local reconciliation.
- `lib/srs/scheduler.ts` — pure schedule reference and unit tests; RPC remains production authority.
- `lib/session/queueTransition.ts` — queue/requeue/completion transition.
- `supabase/migrations/20260804000000_harden_rating_idempotency_contract.sql` — current backend idempotency/result snapshot contract.

## 10. Verification scope

Current unit tests cover scheduler behavior, `applyRatingResult`, request dedupe/generation, auth retry, app snapshot isolation, deterministic quiz/synonym generation, local date utilities and chunk recovery.

Chưa có trong repository:

- E2E browser harness;
- automated mobile Safari tests;
- multi-tab integration tests;
- automated cross-timezone/DST browser matrix.

# TOEIC Test Phase 8 — Secure Learning Content, Practice Feedback and Vocabulary Integration

Ngày triển khai: 2026-08-05  
Phạm vi: learning content sau explicit Practice check và sau submit; không
triển khai Phase 9–12.

## 1. Kết luận

Phase 8 đã hoàn tất trong phạm vi đã được phê duyệt:

- Practice có nút `Kiểm tra đáp án`, không tự chấm ngay khi user chọn A–D.
- Chỉ câu đã autosave thành công mới có thể gọi feedback RPC.
- Feedback Practice là state tạm thời trong component; không lưu localStorage.
- Exam không hiển thị nút kiểm tra và không thể gọi Practice feedback RPC.
- Review sau submit tải explanation, transcript, translation và vocabulary qua
  boundary riêng, không mở rộng safe test-taking RPC.
- User chọn Collection và Section hiện có để lưu từng từ; duplicate được báo
  rõ, không tự tạo container và không gọi SRS.

Các quyết định đã chuyển sang `APPROVED`: DEC-05, DEC-06, DEC-13 và DEC-21.

## 2. Boundary và state flow

### Practice

```text
Chọn A/B/C/D
  → cập nhật local answer
  → autosave debounce 650ms
  → trạng thái saved
  → user bấm “Kiểm tra đáp án”
  → check_toeic_practice_answer(attempt, question)
  → runtime map
  → hiển thị feedback + learning content
```

Trước khi check, answer còn sửa được. Sau khi có feedback, answer controls bị
khóa cho câu hiện tại. `Thử lại câu này` chỉ xóa feedback/error state trên UI;
không xóa answer server, không tạo answer history mới, không thay đổi attempt,
queue, SRS hoặc review log.

### Review

```text
Submitted attempt
  → get_toeic_attempt_review (answer review hiện có)
  → get_toeic_attempt_review_content (learning content riêng)
  → Part filter hiện có
  → render result → explanation → transcript/translation → vocabulary
```

Transcript và translation của shared passage được render một lần trong danh
sách hiện tại, tránh lặp cùng một nội dung cho nhiều câu.

## 3. Database và RPC

Migration mới:

- `supabase/migrations/20260805160000_create_toeic_learning_content.sql`

Không sửa migration cũ và không thay đổi bảng vocabulary/SRS.

### `check_toeic_practice_answer`

Input:

```text
p_attempt_id uuid
p_question_id uuid
```

Server kiểm tra:

- `auth.uid()` tồn tại;
- attempt tồn tại và thuộc user;
- mode là `practice`;
- status là `in_progress`;
- question nằm trong snapshot;
- answer đã được autosave và `selected_answer` khác null;
- answer key tồn tại ở server.

RPC chỉ đọc và trả đúng một question. Nó không update
`toeic_test_answers.is_correct` và không trả các answer khác.

### `get_toeic_attempt_review_content`

Input:

```text
p_attempt_id uuid
```

Server kiểm tra user sở hữu attempt và status là `submitted`. Response chỉ
gồm các câu trong snapshot, theo position server, cùng các passage thực sự
được tham chiếu. Correct answer chỉ được join ở server tại boundary này.

Cả hai RPC đều `SECURITY DEFINER`, fixed `search_path`, revoke `PUBLIC/anon`
và chỉ grant execute cho `authenticated`.

## 4. DTO và runtime validation

Files:

- `features/toeic-tests/learningContracts.ts`
- `features/toeic-tests/mappers/toeicLearningMapper.ts`
- `features/toeic-tests/mappers/toeicLearningMapper.test.ts`

Mapper kiểm tra:

- UUID, Part 1–7, option A/B/C/D;
- nullable answer/correctness ở review;
- question/passages không trùng;
- question chỉ tham chiếu passage trong response;
- attempt ID của question khớp response;
- vocabulary item có `word`, `partOfSpeech`, `meaningVi`;
- raw vocabulary fallback được giữ lại;
- unexpected/missing fields bị reject;
- không sử dụng forbidden set của safe read để vô tình cấm các field được
  phép ở learning boundary; hai boundary có contract riêng.

Không dùng `any`, không log answer key, session, user ID hay nội dung nhạy
cảm.

## 5. Browser service

File: `features/toeic-tests/services/toeicLearningService.ts`

Service dùng browser Supabase singleton hiện có thông qua dynamic import,
validate UUID trước RPC, map database error về stable `ToeicLearningError`
codes và map response runtime. Không có global cache và không dùng localStorage.

Các service function:

- `checkToeicPracticeAnswer(input)`;
- `getToeicAttemptReviewContent(attemptId)`.

## 6. Practice UI/UX

Files:

- `features/toeic-tests/components/ToeicAttemptWorkspace.tsx`
- `features/toeic-tests/components/ToeicPracticeFeedbackPanel.tsx`
- `features/toeic-tests/components/ToeicLearningContentPanel.tsx`

Behavior:

- nút check chỉ xuất hiện ở Practice;
- disabled khi chưa chọn answer, autosave đang pending/saving, autosave error,
  attempt không active, hết giờ hoặc feedback đang tải;
- success có trạng thái đúng/sai, answer user chọn và answer đúng;
- có loading, error và retry;
- accordion có `aria-expanded`, feedback dùng `aria-live="polite"`;
- explanation AI được tách nhãn “Giải thích bổ sung từ AI”;
- content hiển thị bằng text thuần với `whitespace-pre-wrap`, không render
  unsafe HTML;
- không thay đổi layout/rating/SRS của Flashcard hoặc UI ngoài TOEIC.

Animation không cần GSAP cho Phase 8. Chỉ dùng CSS transition nhẹ ở chevron
accordion; không animate answer, timer, audio hay question palette. Điều này
phù hợp reduced-motion và tránh thêm lifecycle animation vào state feedback.

## 7. Review UI

File: `features/toeic-tests/components/ToeicAttemptReviewPage.tsx`

Review vẫn giữ route, Part filter, result link và answer review hiện có. Learning
content tải best-effort riêng; nếu content fail, answer review vẫn hiển thị và
có retry inline. Nội dung được render sau result, theo thứ tự explanation,
transcript/translation và vocabulary.

## 8. Vocabulary integration

Files:

- `features/toeic-tests/services/toeicVocabularyAdapter.ts`
- `features/toeic-tests/services/toeicVocabularyAdapter.test.ts`
- `features/toeic-tests/components/ToeicVocabularySaveDialog.tsx`

Adapter gọi lại các service hiện có:

- `getCollections`;
- `getTopics(collectionId)`;
- `getVocabByTopic(sectionId)`;
- `addVocabulary`.

Dialog yêu cầu user chọn rõ Collection rồi Section phụ thuộc. Không tự chọn
destination khi có nhiều lựa chọn, không tự tạo Collection/Section. Duplicate
được so theo `trim + lowercase + collapse whitespace` trong cùng Section và
trả trạng thái `duplicate` thay vì insert lại.

Schema vocabulary hiện không có source metadata được phê duyệt; field
`source` của adapter vì vậy không được nhét vào `note` hoặc JSON tùy tiện.
Việc này được ghi nhận để quyết định riêng nếu cần ở phase sau.

Save vocabulary không gọi:

- `submit_vocabulary_rating`;
- scheduler/SRS;
- review log;
- queue/requeue;
- interval hoặc progress mutation.

## 9. Security verification

File: `supabase/tests/toeic_phase8_learning_verification.sql`

Đã kiểm tra:

- hai RPC tồn tại và grant đúng;
- anon không execute được;
- authenticated không có direct SELECT answer key/answers/attempt snapshot;
- authenticated không có direct answer INSERT/UPDATE;
- answer-key RLS vẫn FORCE RLS;
- Practice RPC không update/insert answers;
- safe `get_published_toeic_test_part` không chứa learning fields.

Data-level local integration đã kiểm tra Practice owner flow, Exam rejection,
snapshot membership, autosave/resume/abandon và không trả answer key qua safe
content.

## 10. Tests và verification

Unit tests mới:

- `toeicLearningMapper.test.ts` — valid/malformed/unexpected/membership;
- `toeicLearningService.test.ts` — RPC args, stable errors, UUID validation;
- `toeicPracticeFeedbackState.test.ts` — Practice/Exam/autosave gate;
- `toeicVocabularyAdapter.test.ts` — duplicate, existing destination, no
  auto-create, foreign Section.

Local integration với `prototype/2026-test-1-id_ad780150.json`:

- importer dry-run: 200 questions, 42 passages, 200 answer keys;
- local apply và publish Test 1;
- Practice Part 5: 30 câu;
- autosave 2 câu và resume khôi phục 2 answer states;
- Practice feedback success;
- abandon success, autosave sau abandon bị reject;
- Exam: 200 câu và Practice feedback bị reject với `PRACTICE_ONLY`.

## 11. Preservation confirmation

Không thay đổi:

- SRS formulas, rating mapping, intervals, counters hoặc queue;
- `submit_vocabulary_rating`;
- vocabulary schema, RLS và CRUD semantics;
- attempt start/autosave/resume/abandon;
- submit/scoring/result/review contract hiện có;
- safe test-taking read RPC;
- answer-key isolation;
- private media/signing boundary;
- UI ngoài TOEIC.

## 12. Deferred work

Chưa triển khai Phase 9–12: history/progress/wrong-question retry, notes,
annotations, dictionary, dictation, flip, strike-through, audio policy/speed/
mute, image zoom, font size, pause, offline/multiple-tab policy, scaled score,
entitlement, licensing và release UAT.

## 13. Skills đã audit và áp dụng

Đã đọc các skill có sẵn trong `.agents/skills` phù hợp với task:

- `design-taste-frontend`: giữ nguyên visual system EasyTOEIC, chỉ bổ sung
  panel/dialog cần cho learning flow;
- `impeccable`: chạy context và detector cho các component UI thay đổi;
- `ui-ux-pro-max`: áp dụng touch target, semantic state, responsive stacked
  layout và không dùng màu làm tín hiệu duy nhất;
- `accessibility`: dùng `aria-live`, `aria-expanded`, dialog semantics, focus
  return và keyboard close/trap;
- `gsap-react`: audit khả năng dùng GSAP và cleanup/reduced-motion guidance;
- `next-best-practices`: giữ client boundary/service dynamic import;
- `supabase-postgres-best-practices`: fixed search path, explicit projection,
  RPC security boundary và SQL verification;
- `vitest`: thêm unit tests cho mapper, service, adapter và feedback gate.

`@gsap/react` không có trong dependencies và Phase 8 không cần animation có
giá trị đủ lớn để dùng GSAP. Vì vậy không thêm GSAP animation; chỉ dùng CSS
transition nhỏ cho accordion và không animate các control học/thi.

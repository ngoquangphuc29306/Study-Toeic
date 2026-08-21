# TOEIC Test Module — Post Phase 10.5 UI Changes

## 1. Mục đích tài liệu

Tài liệu này ghi lại các thay đổi giao diện và interaction được thực hiện sau
baseline Phase 10.5 — UI parity reconstruction.

Phạm vi của tài liệu là các thay đổi đã có trong production code hiện tại,
đặc biệt là:

- workspace xem lại đáp án sau khi nộp bài;
- feedback cho nhóm câu trong Practice;
- vị trí transcript, bản dịch và từ vựng;
- chuẩn hóa nội dung passage và khoảng cách dòng;
- floating Annotator toolbar có thể kéo thả;
- các capability chưa có contract vẫn được hiển thị disabled hoặc không hiển thị.

Không có thay đổi database, migration, RPC, RLS, SRS hoặc answer-key contract
trong phần mở rộng này.

---

## 2. Nguyên tắc bảo toàn

Các ranh giới sau vẫn được giữ nguyên:

| Boundary | Trạng thái |
| --- | --- |
| Attempt lifecycle | Không thay đổi |
| Autosave answer/flag | Không thay đổi |
| Submit và server scoring | Không thay đổi |
| Review answer key | Chỉ đọc sau khi attempt đã submit và qua service hiện có |
| Practice feedback | Dùng RPC/service hiện có, không gửi answer key trước khi kiểm tra |
| Media | Vẫn dùng signed media boundary/private bucket hiện tại |
| Annotation | Vẫn dùng `createToeicAnnotation` và `deleteToeicAnnotation` |
| Vocabulary save | Vẫn dùng flow chọn Collection/Section hiện có |
| SRS và vocabulary rating | Không liên quan, không thay đổi |
| Database/schema/RLS | Không thay đổi |

UI mới không được xem là security boundary. Việc ẩn hoặc disable một control
chỉ phục vụ UX; quyền truy cập dữ liệu vẫn do service/RPC/server boundary quyết
định.

---

## 3. Thay đổi chính

### 3.1. Workspace xem lại đáp án sau khi nộp bài

**File:** `features/toeic-tests/components/ToeicAttemptReviewPage.tsx`

Màn hình review trước đây hiển thị dữ liệu theo dạng các card liên tiếp, khó
theo dõi quan hệ giữa passage, nhóm câu, câu hỏi và đáp án. Màn hình mới dùng
layout gần với workspace thi/luyện tập:

```text
Review header
  → bộ lọc Part
  → nhóm câu / câu đơn
      → cột trái: passage, image/audio, transcript, translation
      → cột phải: câu hỏi, đáp án A-D, trạng thái đúng/sai, giải thích
```

Các hành vi đã triển khai:

- Tải review result bằng `getToeicAttemptReview`.
- Tải learning content bằng `getToeicAttemptReviewContent`.
- Tải safe published Part payload bằng `getPublishedToeicTestPart` để lấy
  question text, option text, passage và media mà không đọc answer key từ
  catalog read boundary.
- Gom Part 3, 4, 6 và 7 theo `passageId`.
- Part 1, 2 và 5 tiếp tục hiển thị theo từng câu.
- Hiển thị đủ bốn lựa chọn A/B/C/D.
- Đáp án đúng được đánh dấu xanh.
- Lựa chọn user đã chọn nhưng sai được đánh dấu đỏ.
- Câu chưa trả lời có trạng thái riêng, không bị hiểu nhầm là câu sai.
- Giữ link quay lại result, retry câu sai và lưu từ vựng.
- Giải thích, transcript, translation và vocabulary được đặt trong learning
  panel có thể thu gọn.

Đối với nhóm câu:

- Vocabulary được merge và deduplicate theo `word + partOfSpeech`.
- Vocabulary của nhóm chỉ hiển thị một lần ở cuối nhóm.
- Transcript/translation của passage không lặp lại trong từng câu nếu đã nằm
  ở cột nội dung bên trái.

### 3.2. Feedback một lần cho cả nhóm câu trong Practice

**Files:**

- `features/toeic-tests/components/ToeicAttemptWorkspace.tsx`
- `features/toeic-tests/components/ToeicPracticeFeedbackPanel.tsx`

Đối với Part 3, 4, 6 và 7, user phải trả lời toàn bộ câu trong nhóm trước khi
kiểm tra:

1. User chọn đáp án cục bộ cho từng câu.
2. Nút `Kiểm tra đáp án nhóm câu` chỉ xuất hiện/kích hoạt khi nhóm đã đủ đáp án.
3. Client gọi service feedback hiện có cho từng câu trong nhóm.
4. Kết quả feedback hiển thị ngay dưới từng câu.
5. Toàn bộ đáp án đúng/sai, giải thích và learning content của nhóm được mở.

Không có RPC mới và không thay đổi semantics của answer autosave. Feedback
Practice vẫn khác với Exam: Exam không được mở answer key trước submit.

### 3.3. Chuẩn hóa vị trí transcript và bản dịch

Quy tắc hiển thị sau thay đổi:

| Part | Vị trí transcript/translation |
| --- | --- |
| Part 1/2 | Theo content của câu hỏi khi có dữ liệu |
| Part 3/4 | Cột trái, ngay dưới audio/media của nhóm |
| Part 5 | Trong learning panel của câu |
| Part 6/7 | Cột trái, cùng khu vực passage |

Mục tiêu là tránh việc người học phải đọc passage ở một phía nhưng phải kéo
qua phía khác để xem transcript hoặc bản dịch liên quan.

`ToeicPracticeFeedbackPanel` nhận các cờ hiển thị riêng:

- `showTranscript`;
- `showTranslation`;
- `showVocabulary`.

Nhờ đó, nội dung được render một lần ở đúng vị trí thay vì lặp ở cả passage và
từng question.

### 3.4. Chuẩn hóa passage text và giảm khoảng cách dòng

**Files:**

- `features/toeic-tests/passageText.ts`
- `features/toeic-tests/passageText.test.ts`
- `features/toeic-tests/components/ToeicPassageRenderer.tsx`
- `features/toeic-tests/components/ToeicLearningContentPanel.tsx`

Đã xử lý các passage chứa HTML legacy như:

- `<div>`;
- `<p>`;
- `<br>`;
- entity HTML;
- tag lặp hoặc title bị lặp.

Utility `normalizeToeicPassageText` chuyển nội dung về text an toàn, giữ line
break cần thiết, loại bỏ blank line lặp và không render raw HTML trực tiếp.

`ToeicPassageRenderer` hiện:

- Không dùng `dangerouslySetInnerHTML` cho passage runtime.
- Render nội dung theo block text dễ đọc.
- Dùng line-height compact hơn.
- Cho phép text dài tự wrap bằng `break-words`.
- Tránh hiển thị heading/title hai lần.
- Giữ fallback rõ ràng khi passage không có nội dung.

`CompactText` trong `ToeicLearningContentPanel`:

- tách theo dòng có nội dung;
- loại bỏ dòng rỗng dư thừa;
- giữ line break hợp lệ;
- giảm khoảng cách giữa các đoạn trong explanation, transcript và translation.

### 3.5. Floating Annotator toolbar

**File:** `features/toeic-tests/components/ToeicLearningToolsPanel.tsx`

Khi user bấm `Annotator`, thay vì mở một panel ngang trong header, hệ thống
hiển thị thanh công cụ dọc nổi ở góc trái màn hình, theo tinh thần prototype.

#### Vị trí và drag interaction

- Toolbar dùng `position: fixed` và z-index riêng.
- Vị trí mặc định ở góc trái, phía dưới header.
- Kéo biểu tượng grip để di chuyển toolbar.
- Tọa độ được clamp theo viewport để toolbar không bị kéo hoàn toàn ra ngoài
  màn hình.
- Có hỗ trợ phím mũi tên khi grip đang focus.
- Nút đóng toolbar trả về trạng thái Annotator chưa mở.
- Khi chuyển question, toolbar được reset theo lifecycle của learning tools hiện
  tại.

#### Các control đang hoạt động thật

| Control | Hành vi |
| --- | --- |
| Chọn | Chọn văn bản để tạo selection draft |
| Highlight | Chọn style highlight cho annotation |
| Gạch chân | Chọn style underline cho annotation |
| Đổi kiểu đánh dấu | Chuyển qua lại highlight/underline |
| Mở danh sách annotation | Mở panel annotation hiện có |
| Xóa annotation đã chọn | Gọi `deleteToeicAnnotation`, sau đó cập nhật state local |
| Lưu đánh dấu | Gọi `createToeicAnnotation` qua `AnnotationTool` hiện có |
| Bỏ chọn | Xóa selection hiện tại |

Annotation vẫn được neo bằng quote và text offsets thông qua
`toeicAnnotationAnchoring`; toolbar không thay đổi cách lưu hoặc resolve
annotation.

#### Các control đang disabled

Các control sau chỉ được dựng để khớp vị trí và hierarchy của prototype, chưa
được giả lập behavior:

- vẽ tự do;
- tẩy theo vùng;
- thêm text tự do;
- thêm note trực tiếp lên canvas;
- vẽ hình chữ nhật;
- vẽ mũi tên;
- undo;
- redo;
- hiện/ẩn toàn bộ annotation.

Lý do: các behavior này chưa có contract state/persistence riêng trong Phase
10.5. Việc disable giúp tránh tạo dữ liệu không có server authority hoặc làm
user hiểu rằng feature đã hoàn thiện.

### 3.6. Learning tools cleanup

Thanh learning tools không còn hiển thị nút `Tra từ` trong toolbar chính theo
quyết định UI trước đó. Lookup service và các boundary liên quan không bị xóa;
chỉ entry point ở toolbar đã được loại bỏ để tránh trùng với flow tra từ theo
context.

Các tool còn lại vẫn giữ entry point:

- Ghi chú;
- Annotator;
- Điền từ trong Practice;
- Lật từ trong Practice.

---

## 4. Data flow và source of truth

### Practice

```text
answer local state
  → autosave coordinator hiện có
  → check_toeic_practice_answer/service hiện có
  → feedback state
  → render feedback dưới câu hoặc cuối nhóm
```

### Review sau submit

```text
submitted attempt
  → getToeicAttemptReview
  → getToeicAttemptReviewContent
  → safe published Part payloads
  → map theo questionId/passageId
  → render read-only review workspace
```

### Annotation

```text
user bôi đen text
  → buildSelectionDraft
  → chọn highlight/underline
  → createToeicAnnotation
  → cập nhật annotations state
```

Xóa annotation:

```text
user chọn annotation
  → deleteToeicAnnotation
  → onDeleted
  → cập nhật UI
```

Không có state nào trong các flow trên dùng localStorage làm source of truth.

---

## 5. Security và capability boundary

### Dữ liệu được phép hiển thị

- Question text và option text: safe read payload.
- Correct answer và correctness: chỉ từ Practice feedback hợp lệ hoặc Review
  sau submit.
- Explanation, transcript, translation: chỉ qua learning content boundary đã
  có.
- Media: chỉ qua signed media client hiện có.
- Annotation và notes: user-private service/RPC hiện có.

### Dữ liệu không được mở sớm

- answer key trong catalog hoặc Exam workspace;
- `isCorrect` trước Practice check hoặc submit review;
- raw answer-key table;
- dữ liệu của attempt user khác.

Giao diện review mới không tự tính correctness. Nó chỉ map kết quả đã được
server/service trả về.

---

## 6. Files thay đổi liên quan

Các file production chính trong nhóm thay đổi sau Phase 10.5:

| File | Vai trò |
| --- | --- |
| `features/toeic-tests/components/ToeicAttemptReviewPage.tsx` | Review workspace 2 cột, group question, answer states |
| `features/toeic-tests/components/ToeicAttemptWorkspace.tsx` | Group practice feedback, content placement, vocabulary merge |
| `features/toeic-tests/components/ToeicPracticeFeedbackPanel.tsx` | Feedback panel và cờ hiển thị transcript/translation/vocabulary |
| `features/toeic-tests/components/ToeicLearningToolsPanel.tsx` | Floating Annotator toolbar và learning tool entry points |
| `features/toeic-tests/components/ToeicPassageRenderer.tsx` | Passage renderer compact và safe text rendering |
| `features/toeic-tests/components/ToeicLearningContentPanel.tsx` | Compact explanation/transcript/translation/vocabulary sections |
| `features/toeic-tests/passageText.ts` | Pure text normalization utility |
| `features/toeic-tests/passageText.test.ts` | Unit tests cho passage normalization |
| `features/toeic-tests/components/ToeicMediaView.tsx` | Media display trong workspace/review |
| `docs/TOEIC_TEST_PHASE10_5_UI_PARITY.md` | Baseline parity documentation |
| `docs/TOEIC_TEST_PHASE10_5_POST_CHANGES.md` | Tài liệu chi tiết này |

Các file service/RPC/migration được gọi lại nhưng không được thay đổi trong
phạm vi post-Phase 10.5 này.

---

## 7. Những phần chưa triển khai

Các capability sau vẫn cần phase riêng, không được coi là đã hoàn thành chỉ vì
đã có icon trên toolbar hoặc vị trí UI:

- listening lock;
- seek/replay restriction trong Exam;
- auto-advance theo audio;
- custom Exam duration;
- pause làm dừng server deadline;
- aggregate analytics theo Part/skill;
- total duration aggregate;
- scaled score 10–990;
- vocabulary summary ở test card;
- freehand annotation persistence;
- text/shape/arrow annotation model;
- undo/redo annotation history;
- bật/tắt toàn bộ annotation theo session;
- notes/annotation rich editor hoàn chỉnh;
- offline annotation sync và multi-tab conflict resolution.

Những phần này không được giải quyết bằng client-only calculation hoặc fake
data.

---

## 8. Manual test checklist

### Review workspace

- Mở một attempt đã submit và vào `Xem lại đáp án`.
- Kiểm tra Part 1/2/5 hiển thị từng câu.
- Kiểm tra Part 3/4/6/7 hiển thị theo nhóm passage.
- Xác nhận đáp án đúng màu xanh.
- Xác nhận lựa chọn sai màu đỏ.
- Xác nhận câu bỏ trống có trạng thái riêng.
- Kiểm tra transcript/translation ở cột trái đối với nhóm passage.
- Kiểm tra vocabulary nhóm chỉ xuất hiện một lần ở cuối nhóm.
- Kiểm tra media lỗi có fallback, không làm crash toàn trang.

### Practice group

- Chọn thiếu một câu trong nhóm: không được check nhóm.
- Chọn đủ câu: nút check nhóm xuất hiện/kích hoạt.
- Check nhóm: feedback xuất hiện dưới từng câu.
- Kiểm tra không lộ feedback khi đang ở Exam.
- Chuyển sang nhóm khác và quay lại: autosave/answer state không bị reset sai.

### Annotator

- Bấm Annotator: toolbar xuất hiện ở góc trái.
- Kéo toolbar tới vị trí khác trên desktop.
- Kéo toolbar trên viewport hẹp, xác nhận không bị mất hoàn toàn khỏi màn hình.
- Bôi đen passage/question text.
- Chọn Highlight hoặc Gạch chân.
- Lưu annotation và xác nhận annotation xuất hiện trong danh sách.
- Chọn annotation đã lưu và xóa.
- Reload/resume: annotation vẫn theo server boundary hiện có.
- Bấm các control disabled: không tạo dữ liệu giả và không phát sinh request.
- Kiểm tra keyboard focus, `aria-label`, Escape/close theo shell hiện tại.

### Responsive

- Desktop 1440px và 1280px.
- Tablet 1024px và 768px.
- Mobile 390px và 360px.
- Zoom trình duyệt 125% và 200%.
- Nội dung passage dài, option dài và translation nhiều dòng.

---

## 9. Quality gates đã chạy

| Command | Kết quả |
| --- | --- |
| `npx eslint features/toeic-tests/components/ToeicAttemptReviewPage.tsx` | Pass |
| `npx eslint features/toeic-tests/components/ToeicLearningToolsPanel.tsx` | Pass |
| `npx tsc --noEmit` | Pass |
| `git diff --check` | Pass |
| Impeccable detector trên review page | Không phát hiện warning |
| Impeccable detector trên learning tools panel | Không phát hiện warning |
| `npm run lint` | Không pass do 7 lỗi trong generated `.next-stale-recovery`; không nằm trong source thay đổi |
| `npx eslint . --ignore-pattern .next-stale-recovery --ignore-pattern .next` | 0 error, còn 9 warning cũ |

Các warning còn lại ngoài phạm vi gồm native `<img>`, dependency trong
prototype và một eslint-disable cũ trong workspace.

Trong bước viết tài liệu này không chạy lại database reset, migration lint hoặc
production deployment vì không có thay đổi SQL/backend.

---

## 10. Git và release status

Tài liệu này chỉ được tạo để ghi nhận thay đổi. Tại thời điểm lập tài liệu:

- chưa stage;
- chưa commit;
- chưa push;
- chưa deploy.

Các thay đổi code chưa được xem là release-ready cho đến khi manual checklist
được chạy trên test data thực tế và xử lý riêng lỗi lint do generated build
artifacts trong `.next-stale-recovery`.


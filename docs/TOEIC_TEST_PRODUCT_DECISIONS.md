# TOEIC Test Product Decisions

These decisions were collected during the Phase 7.5 parity audit. They are
recommendations until explicitly approved. `OPEN` means engineering must not
infer the policy from prototype behavior. Phase 8 decisions DEC-05, DEC-06,
DEC-13 and DEC-21 are now approved and have acceptance/test evidence in
`docs/TOEIC_TEST_PHASE8_LEARNING_CONTENT.md`.

| Decision ID | Question | Options | Recommendation | Reason | Status | Blocking phase |
|---|---|---|---|---|---|---|
| DEC-01 | Exam có được pause không? | Không pause; pause được nhưng deadline vẫn chạy; pause dừng deadline | Không pause trong Exam hoặc chỉ pause UI không dừng server deadline | Pause làm thay đổi tính đúng đắn của bài thi nếu server không có contract | OPEN | Phase 11/12 |
| DEC-02 | Pause có dừng server deadline không? | Không; Có; chỉ Practice | Nếu hỗ trợ, phải là server-authoritative event và audit trail; không chấp nhận client-only pause | Browser clock không được điều khiển deadline | OPEN | Phase 11/12 |
| DEC-03 | Listening Exam có được seek không? | Không; seek tự do; seek chỉ trong audio hiện tại | Không seek trong Exam, cho phép linh hoạt trong Practice | Phù hợp parity report và tránh thay đổi điều kiện Listening | OPEN | Phase 11 |
| DEC-04 | Listening Exam có được replay không? | Không; một lần; giới hạn số lần; tự do | Một lần phát tự động/controlled theo policy; Practice tự do | Replay ảnh hưởng tính tương đương đề thi | OPEN | Phase 11 |
| DEC-05 | Practice có immediate feedback không? | Có ngay; sau khi chọn tiếp; chỉ sau submit | Chỉ trả feedback sau khi user bấm “Kiểm tra đáp án”; không dùng cho Exam | Đã triển khai `check_toeic_practice_answer` sau autosave, không lấy answer key qua safe read | APPROVED | Phase 8 |
| DEC-06 | Practice có được đổi answer sau feedback không? | Không; Có; reset câu | Trước check được sửa; sau check feedback giữ ổn định; “Thử lại câu này” chỉ reset feedback UI | Đã triển khai, không thay đổi answer history hay SRS | APPROVED | Phase 8 |
| DEC-07 | Audio speed áp dụng cho mode nào? | Cả hai; Practice only; không có | Practice only mặc định; Exam theo rule nội dung được duyệt | Prototype có 0.8/1.0/1.2/1.5 nhưng Exam parity chưa được phê duyệt | OPEN | Phase 11 |
| DEC-08 | Auto-submit khi hết giờ? | Tự submit; chuyển trạng thái expired rồi user xác nhận; không submit | Server finalization sau khi hết giờ, có idempotency; UI có thể hiển thị trạng thái chờ | Client đổi mode sang review là không đủ an toàn | OPEN | Phase 12 |
| DEC-09 | Expired Exam có tự finalize không? | Có; chỉ cho submit persisted answers; không cho finalize | Cho phép finalize answer đã lưu bằng RPC sau expiry | Phase 7 đã hỗ trợ expired Exam submit; cần UX thống nhất | OPEN | Phase 12 |
| DEC-10 | Official scaled score policy? | Không hiển thị; raw only; bảng quy đổi theo test/source | Raw only cho đến khi content owner phê duyệt bảng/version | Không được fake hoặc gọi raw accuracy là điểm TOEIC | OPEN | Phase 9 |
| DEC-11 | Notes scope? | Test; question; passage; cả ba | Test + question trước; passage dùng liên kết question nếu cần | Giảm mô hình và vẫn đáp ứng học lại | OPEN | Phase 10 |
| DEC-12 | Annotation scope? | Test; question; passage; local-only | Question/passage, owner-private server persistence | Prototype lưu per question; cần cross-device nếu giữ feature | OPEN | Phase 10 |
| DEC-13 | Vocabulary destination flow? | Tự tạo Collection/Section; chọn existing; chọn hoặc tạo có xác nhận | Chọn Collection/Section hiện có; tạo mới chỉ bằng hành động xác nhận riêng | Dialog Phase 8 chỉ cho phép chọn destination hiện có, kiểm tra duplicate, không auto-create | APPROVED | Phase 8 |
| DEC-14 | Reset progress nghĩa là gì? | Xóa lịch sử; archive; reset filter/UI | Archive/hide khỏi progress, không xóa audit history mặc định | Xóa localStorage prototype không phù hợp server history | OPEN | Phase 9 |
| DEC-15 | Wrong-question retry tạo gì? | Filter review; attempt Practice mới; sửa attempt cũ | Practice attempt mới, server chọn question set | Giữ lịch sử submit bất biến và audit được | OPEN | Phase 9 |
| DEC-16 | Free/premium access rule? | Public; authenticated; entitlement/subscription | Entitlement server-side trên catalog/start RPC | Fixture có `is_free`, production chưa có entitlement boundary | OPEN | Phase 12 |
| DEC-17 | Media licensing/distribution? | Internal only; signed authenticated; public; provider-hosted | Chỉ phát hành content có quyền; private signed media | Signed URL không thay thế giấy phép nội dung | OPEN | Phase 12 |
| DEC-18 | Có cho tải audio/image trực tiếp không? | Không; download có entitlement; public | Không download mặc định; nếu có phải có entitlement/license policy | Giảm rủi ro phân phối ngoài quyền | OPEN | Phase 12 |
| DEC-19 | Offline có được hỗ trợ không? | Không; cache read-only; unsent answer queue | Defer read-only/offline queue cho đến khi usage cần | Offline sync tăng conflict/idempotency surface | OPEN | Phase 12 |
| DEC-20 | Multiple tabs được hỗ trợ ở mức nào? | Không; last-write-wins; coordinator | Không cam kết ở MVP; vẫn phải không duplicate submit | Existing mutation ledger bảo vệ server nhưng không giải quyết UX stale tab | OPEN | Phase 12 |
| DEC-21 | Explanation/transcript/translation khi nào được xem? | Trong Exam; Practice ngay; post-submit only | Practice theo explicit check; Exam chỉ sau submit | Learning RPC tách riêng, safe read không đổi, Review owner-only | APPROVED | Phase 8 |
| DEC-22 | Source/content policy? | Prototype sources được giữ; admin review; xóa source không rõ quyền | Chỉ import/publish sau content/licensing review | Prototype fixture có source/media metadata nhưng không chứng minh quyền phân phối | OPEN | Phase 12 |

## Decision handling rule

Until a row is `APPROVED`, implementation must preserve the current safe
production contract and must not infer behavior from a prototype-only control.
An approved decision must be converted into acceptance tests before UI/RPC
work begins.

## Phase 9 approval addendum

The following decisions are now approved for Phase 9 and supersede their
earlier `OPEN` audit rows:

| Decision ID | Approved policy | Evidence | Status |
|---|---|---|---|
| DEC-10 | Raw result only; `scaledScore` remains `null`; no calculator or 10–990 approximation. | `submission_result`, `ToeicAttemptResultPage`, Phase 9 history/progress contract. | APPROVED |
| DEC-14 | Reset progress hides/restores owner progress summaries and never deletes attempts/results. | `toeic_test_progress_preferences`, `set_toeic_test_progress_visibility`, catalog control. | APPROVED |
| DEC-15 | Wrong retry creates a new Practice attempt from server-selected incorrect answers; source attempt is immutable. | `start_toeic_wrong_question_attempt`, provenance column, idempotency and SQL verification. | APPROVED |

The remaining OPEN rows continue to block their planned phases and are not
implicitly changed by Phase 9.

## Phase 10 approval addendum

The following rows supersede the earlier Phase 7.5 recommendations for the
Phase 10 learning-tools scope:

| Decision ID | Approved policy | Evidence | Status |
|---|---|---|---|
| DEC-11 | Notes support exactly one test note and one note per question. Notes are plain text, owner-private, editable, deletable, server-authoritative and cross-device. Passage-only notes are deferred. | `toeic_test_notes`, note RPCs, `toeicToolService`, `ToeicLearningToolsPanel`. | APPROVED |
| DEC-12 | Annotations target question text or passage document text. MVP styles are `highlight` and `underline`, with an optional short comment; annotations use offsets plus a quote snapshot and remain owner-private. | `toeic_text_annotations`, annotation RPCs, `toeicAnnotationAnchoring`, semantic `mark` rendering. | APPROVED |
| DEC-23 | Dictionary lookup is server-controlled. No provider or secret is passed by the browser; this repository returns a deterministic unavailable state until a provider is configured. | `/api/toeic-tools/lookup`, `toeicDictionaryService`, lookup allowlist mapper. | APPROVED |
| DEC-24 | Dictation is Practice-only, available after authorized Practice feedback exposes transcript, and compares normalized text without changing answers or scores. | `toeicDictation`, `ToeicLearningToolsPanel`, Phase 8 learning boundary. | APPROVED |
| DEC-25 | Flip is Practice-only vocabulary UI state. It does not write `toeic_test_answers`, SRS state or review logs; vocabulary saving reuses the existing explicit destination dialog. | `ToeicLearningToolsPanel`, `ToeicVocabularySaveDialog`. | APPROVED |

Phase 10 does not approve pause, audio speed, mute, seek/replay policy,
offline sync, multi-tab coordination, auto-submit, entitlement or licensing
release behavior. Those decisions remain open for their planned phases.

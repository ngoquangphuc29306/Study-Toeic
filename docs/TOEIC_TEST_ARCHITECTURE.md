# EasyTOEIC TOEIC Test Module — Phase 1 Architecture and Audit

Ngày audit: 2026-08-05
Phase 1 đã hoàn tất; Phase 2 schema/RLS foundation được triển khai ở cuối tài liệu. Chưa triển khai exam UI, route mới, media upload, importer, autosave coordinator hoặc scoring RPC hoàn chỉnh.

## 1. Kết luận điều hành

Codebase hiện có một app học từ vựng production dùng Next.js App Router, Supabase Auth/RLS và một authenticated SPA tại `/app`. Prototype TOEIC nằm trong `prototype/` là một CBT demo độc lập, chưa phải production feature. Prototype có nhiều ý tưởng UI hữu ích nhưng không thể được đưa thẳng vào production vì:

- answer key được gửi tới client và điểm được tính bằng React;
- tiến độ, notes và từ vựng bài thi được lưu bằng `localStorage`;
- timer, review mode và nhiều business rule chỉ tồn tại trong component rất lớn;
- media đang lưu full public Supabase URLs;
- một số API tra từ/translation được gọi trực tiếp từ browser;
- prototype tạo collection/topic tự động khi lưu từ, trong khi production cần user chọn đích lưu và dùng flow CRUD hiện có.

Phase 1 đã tạo boundary an toàn để các phase sau có thể xây dựng trên đó:

- `features/toeic-tests/types.ts`: typed domain model, tách content khỏi answer key;
- `features/toeic-tests/mediaPath.ts`: pure resolver cho bucket-relative media paths và legacy URLs;
- `features/toeic-tests/mediaPath.test.ts`: unit tests, không gọi Supabase thật;
- tài liệu này.

Phase 2 chỉ thêm một migration TOEIC mới và loại prototype reference khỏi TypeScript production compilation. Không có migration cũ, RPC SRS, schema vocabulary, UI production, package version hoặc navigation nào bị thay đổi.

## 2. Current production architecture audit

### 2.1 Route, navigation và auth guard

Routes hiện tại gồm:

- `/`: landing page công khai;
- `/login`, `/signup`, `/forgot-password`, `/reset-password`;
- `/auth/callback`: route đổi auth code lấy session;
- `/app`: authenticated SPA chứa Dashboard, Flashcard, Synonym Practice và Vocabulary Manager;
- `/app/account`: account settings.

`app/app/page.tsx` dùng `activeTab` thay vì mỗi feature là một App Router page riêng. Navigation hiện có các tab `dashboard`, `flashcard`, `synonyms` và `vocab-manager`. Chưa có route `/tests`, `/exam` hoặc TOEIC navigation.

`middleware.ts` gọi `lib/supabase/middleware.ts`. Middleware tạo server client, gọi `auth.getUser()`, làm mới cookie và bảo vệ `/app` cùng các route con. Browser client là singleton trong `lib/supabase/client.ts`; server client dùng cookies trong `lib/supabase/server.ts`. Auth callback dùng server client và safe internal redirect.

Đề xuất cho phase route sau: route protected `/app/tests` (hoặc một tab được product phê duyệt), với domain code ở `features/toeic-tests/`. Không thêm route ở Phase 1 để tránh thay đổi navigation contract.

### 2.2 Data loading và service conventions

`services/appDataService.ts` là snapshot boundary hiện tại. Core collections/topics/vocabularies được tải qua các service có Supabase RLS và auth retry; metrics/week activity là derived data và được xử lý best-effort. `services/vocabService.ts` là facade cho các thao tác vocabulary/collection/topic và SRS rating; `services/vocabularyService.ts` là service CRUD thấp hơn.

Các đặc điểm cần giữ khi thêm TOEIC:

- dùng browser Supabase singleton, không tạo client mới trong mỗi request;
- giữ auth/session retry và request coordinator hiện có;
- không đưa TOEIC data vào `loadAppDataSnapshot()` cho đến khi feature có contract riêng;
- không dùng local state hoặc localStorage làm nguồn sự thật cho test attempts;
- không đưa answer key vào response phục vụ exam client.

### 2.3 Storage và media hiện tại

Avatar dùng Supabase Storage private bucket và signed URL trong `services/profileService.ts`. Vocabulary có `audio_url` và các component hiện tại có helper `speechSynthesis`; chưa có TOEIC media resolver dùng bucket-relative path.

Các local/session storage hiện tại thuộc nhóm preference, review reminder, password recovery hoặc pending session/rating recovery. Production SRS data không nên được xem là localStorage source of truth. Prototype TOEIC là ngoại lệ cần thay thế, không phải convention để sao chép.

### 2.4 Testing convention

Project dùng Vitest (`vitest run`), Node environment, globals, alias `@` trỏ root và include `**/*.test.ts`. Test hiện có là pure utility/service tests với mock boundary, không kết nối Supabase production. Foundation TOEIC dùng cùng convention và không thêm package.

Project không khai báo `zod` là direct dependency. Có một số package transitive chứa Zod trong lockfile nhưng không được import trực tiếp. Zod schema cho JSON import sẽ được xem xét ở phase importer sau khi dependency và contract được phê duyệt; Phase 1 không đổi package.

## 3. Prototype audit

### 3.1 Files and responsibilities

- `prototype/BAO_CAO_CHUC_NANG_DE_THI.md`: mô tả ý tưởng CBT: full test 200 câu/120 phút, listening lock, practice theo part, review, grid, audio, passage, annotation, font scale, auto-fill, explanation và save vocabulary.
- `prototype/ToeicTestCatalog.tsx`: catalog/demo progress; lưu notes, vocabulary map và progress bằng localStorage; test cards/counts một phần hardcoded.
- `prototype/ToeicCbtTest.tsx`: component CBT khoảng 5.5k dòng; normalize data, timer, question navigation, annotations, notes, vocab drawer, external lookup, client answer selection, client scoring và localStorage persistence.
- `prototype/PassageRenderer.tsx`: renderer presentation cho passage text/markdown-like content; không phải data model hoặc security boundary.
- `prototype/2026-test-1-id_ad780150.json`: sample scraped dataset được phân tích tại mục 4.
- `prototype/VocabManager.tsx`, `AddVocabModal.tsx`, `ExcelImportModal.tsx`, `excelUtils.ts`, `types.ts`: bản prototype/clone của flow vocabulary, không phải TOEIC import contract production.

Prototype import path `../public/data/ets2026_test1.json` không khớp vị trí sample hiện tại trong `prototype/`; đây là dấu hiệu prototype path không được xem là production asset contract.

### 3.2 Prototype behavior incompatible with production

1. `ToeicCbtTest.tsx` nhận `correct_answer` trong dataset, sau đó so sánh `userChoice === q.correct_answer` và tính listening/reading score trong client. Điều này làm lộ answer key và cho phép client sửa điểm.
2. `vocabtoeic_cbt_progress`, `vocabtoeic_cbt_notes_${testId}`, `vocabtoeic_cbt_vocabs_${testId}` và `vocabtoeic_cbt_annotations_${testId}` là localStorage keys không có user/attempt ownership server-side.
3. Submit/result chỉ ghi summary localStorage; không có attempt, answer row, server idempotency hay audit log.
4. Timer là `setInterval` trong component. Đây chỉ là display guard; server vẫn phải quyết định attempt status/deadline ở production.
5. `handleSaveVocab` tự tìm hoặc tạo collection theo tên bài thi, tự tạo topic theo Part, rồi gọi `addVocabulary`. Production nên tái sử dụng `addVocabulary`/bulk flow qua callback/adaptor sau khi user chọn collection/section; không tự tạo container và không ghi local test list như source of truth.
6. Lookup gọi API dictionary/translation từ browser. Nếu giữ tính năng tra từ, cần server boundary, rate limit, timeout và xử lý dữ liệu không tin cậy; không đưa vào Phase 1.
7. Renderer/annotation model cần sanitize và ownership validation trước khi dùng với nội dung do import/user tạo.

Prototype có thể cung cấp visual/presentation reference sau khi product phê duyệt, nhưng không được copy toàn bộ component hoặc business logic.

## 4. Complete analysis of sample JSON

File: `prototype/2026-test-1-id_ad780150.json`
Array `questions`: 200 items. Top-level keys: `test`, `scrapedAt`, `questionCount`, `passageCount`, `aiExplanationCount`, `mediaCheck`, `questions`.

### 4.1 Metadata

```text
id             ad780150-f675-42b9-8ced-246862b0d0a8
name           Test 1
set_name       2026
year           2023
source         ETS
is_free        true
media_folder   2026/t1
total_questions 200
```

Additional sample metadata:

- `questionCount`: 200;
- `passageCount`: 42;
- `aiExplanationCount`: 169;
- `mediaCheck`: total 65, ok 65, fixed 0, broken 0.

### 4.2 Part breakdown

| Part | Questions | Options | Audio | Image | Passage ID | Passage text | Transcript | Explanation | Vocabulary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 6 | 4 each | 6 | 6 | 0 | 6 | 0 | 0 | 6 |
| 2 | 25 | 4 each | 25 | 0 | 0 | 25 | 0 | 0 | 25 |
| 3 | 39 | 4 each | 39 | 9 | 39 | 0 | 39 | 39 | 39 |
| 4 | 30 | 4 each | 30 | 6 | 30 | 0 | 30 | 30 | 30 |
| 5 | 30 | 4 each | 0 | 0 | 0 | 0 | 0 | 30 | 30 |
| 6 | 16 | 4 each | 0 | 0 | 16 | 16 | 0 | 16 | 16 |
| 7 | 54 | 4 each | 0 | 0 | 54 | 54 | 0 | 54 | 54 |
| **Total** | **200** | **4 each** | **100** | **21** | **139 refs** | **101** | **69** | **169** | **200** |

`Passage ID` counts above are question references, not unique passage count. The sample has 42 unique passage groups.

Field shape by Part:

- Part 1: `id`, `part`, `section`, `question_number`, `audio_url`, `image_url`, `options`, `correct_answer`, `passage_text`, `dich_nghia`, `tu_vung`.
- Part 2: Part 1 shape without image, with `question_text`.
- Parts 3–4: `passage_id`, `audio_url`, optional group `image_url`, `question_text`, `options`, `correct_answer`, `transcript`, `passage_type`, explanations and vocabulary.
- Part 5: `question_text`, `options`, `correct_answer`, Vietnamese translation/explanation fields and vocabulary; no audio/passage.
- Parts 6–7: `passage_id`, `question_text`, `options`, `correct_answer`, passage text/title/type, translation/explanation fields and vocabulary.

All 200 questions have four options. All have a correct answer. The sample has no duplicate question IDs or question numbers and all seven parts are represented.

### 4.3 Passage groups

All 42 unique `passage_id` values are reused; there are no singleton passage IDs in this sample. No group crosses Parts.

- Part 3: 13 groups, each 3 questions: 32–34 through 68–70.
- Part 4: 10 groups, each 3 questions: 71–73 through 98–100.
- Part 6: 4 groups, each 4 questions: 131–134 through 143–146.
- Part 7: 15 groups: 147–148, 149–150, 151–152, 153–154, 155–157, 158–160, 161–163, 164–167, 168–171, 172–175, 176–180, 181–185, 186–190, 191–195, 196–200.

The production model must store passages independently and reference them from questions. It must not infer grouping from `question_number`; use imported `passage_id`/normalized passage records.

Part 3/4 groups share conversation/talk audio and sometimes an image. Part 6/7 groups share a passage, and Part 7 supports multi-text/image-style passage types through the passage model rather than a single hardcoded text field.

### 4.4 Media analysis

The sample references 54 unique audio URLs and 11 unique image URLs.

Audio:

- 23 reused groups and 31 singleton references;
- maximum reuse group is 3 questions;
- Part 1 uses `1.mp3`–`6.mp3`;
- Part 2 uses `7.mp3`–`31.mp3`;
- Part 3 uses group filenames `32-34.mp3` through `68-70.mp3`;
- Part 4 uses group filenames `71-73.mp3` through `98-100.mp3`;
- Parts 5–7 have no audio in this dataset.

Images:

- 11 unique `.webp` files, with 5 reused groups and 6 singleton references;
- Part 1 uses `1.webp`–`6.webp`;
- shared/group images include `62-64.webp`, `65-67.webp`, `68-70.webp`, `95-97.webp`, `98-100.webp`;
- no image is present for Parts 2, 5, 6 or 7 in this sample.

All 65 media references passed the sample's `mediaCheck`. Repeated URLs are intentional group reuse, not duplicate rows to import. Filename grouping is evidence from media fields and passage relationships, not an inference from question numbers.

The JSON stores full URLs such as:

```text
https://qfhmnlvgweznzcsoijyr.supabase.co/storage/v1/object/public/mock-test-media/2026/t1/32-34.mp3
```

That is not the desired production storage contract. The existing bucket is named `mock-test-media`; no new bucket was created. A future decision is required before import. For licensed ETS-style content, the recommended MVP is a private bucket with server-issued signed URLs and no answer key in client payloads. A public bucket is simpler only if product/legal explicitly decides all published media may be public. In either case the DB stores `media_folder` plus a relative path, not a project URL.

## 5. Phase 1 foundation implemented

### 5.1 Typed domain boundary

`features/toeic-tests/types.ts` defines:

- test parts 1–7, listening/reading sections, test/attempt statuses and modes;
- strict A/B/C/D option keys;
- `ToeicTest`, `ToeicPassage`, `ToeicQuestionContent`;
- separate `ToeicQuestionAnswerKey` so a client question payload has no answer key;
- vocabulary notes, attempts, answer rows and a result shape.

The types do not change runtime behavior or existing data. They are a contract for future services and import validation.

### 5.2 Pure media resolver

`features/toeic-tests/mediaPath.ts` exposes:

- `extractStorageFilename(value)`;
- `joinStoragePath(...segments)`;
- `buildToeicMediaPath(mediaFolder, source)`;
- `resolveToeicPublicMediaUrl({ supabaseUrl, bucket, mediaFolder, source })`.

The resolver:

- accepts old Supabase object URLs, ordinary URLs and relative filenames;
- strips query/hash and normalizes slash boundaries;
- preserves relative nested paths;
- avoids duplicating an already-prefixed `media_folder`;
- rejects missing/unsafe parent-traversal input;
- encodes path segments for the final URL;
- never creates a Supabase client and never performs network I/O.

The unit tests cover legacy URL extraction, ordinary URL extraction, relative/nested paths, slash normalization, encoded names, missing values and unsafe traversal.

## 6. Production data architecture (finalized in Phase 2)

The TOEIC content and user attempt history should be separate from vocabulary/SRS tables. Suggested tables:

### `toeic_tests`

- `id uuid primary key default gen_random_uuid()`;
- `name`, `set_name`, `year`, `source`, `description`;
- `is_free`, `media_folder`, `total_questions`;
- `status` (`draft`, `published`, `archived`);
- `created_at`, `updated_at` using the existing `timestamptz`/`clock_timestamp()` convention.

### `toeic_passages`

- `id`, `test_id` FK, `part`, `passage_type`, `title`;
- `text`, `text_2`, `text_3` for normalized multi-text content;
- `audio_path`, `image_path`, `transcript` as bucket-relative paths;
- timestamps.

### `toeic_questions`

- `id`, `test_id` FK, nullable `passage_id` FK;
- `part`, `section`, `question_number`, `question_text`;
- option values A/B/C/D;
- media paths, transcript, explanation fields, vocabulary JSONB only if the final contract needs a stable structured note;
- `correct_answer` should be protected from client-facing reads. It may live in this table only with carefully separated server policies, or in a separate answer-key table.

### `toeic_test_attempts`

- `id`, `user_id`, `test_id`, `mode`, `status`;
- `started_at`, `submitted_at`, optional `deadline_at`;
- unique/idempotency metadata for submit operations;
- server timestamps.

### `toeic_test_answers`

- `id`, `attempt_id`, `question_id`, selected option, `answered_at`;
- unique `(attempt_id, question_id)`;
- ownership is derived through the attempt FK, not a client-provided user ID;
- server-computed correctness should not be accepted from the browser.

Recommended indexes:

- `toeic_tests(status, set_name)`;
- `toeic_passages(test_id, part)`;
- `toeic_questions(test_id, part, question_number)`;
- `toeic_questions(passage_id, question_number)`;
- `toeic_test_attempts(user_id, started_at desc)`;
- `toeic_test_answers(attempt_id, question_id)` unique;
- indexes on every FK used for RLS joins.

No analytics, notes, annotations or vocabulary-integration tables are included. The answer-key table is required and is implemented separately in Phase 2. Do not add denormalized score tables prematurely.

## 7. RLS and ownership model

Content read policy:

- anonymous users: no access;
- authenticated users: read only rows where `status = 'published'`;
- import/admin writes: server-side controlled path, not ordinary user insert/update/delete;
- never expose answer-key columns through a client-readable policy/view.

Attempt policy:

- authenticated user can select/insert/update only attempts where `user_id = auth.uid()`;
- users can read/insert/update their own answer rows through ownership derived from `attempt_id`;
- no user can update a submitted attempt or another user's attempt;
- delete policy should be intentionally decided, not inherited from generic CRUD.

If a separate answer-key table is used, grant access only to a `SECURITY DEFINER` scoring function with a fixed `search_path`, explicit ownership checks and no client grant. Follow existing `auth.uid()` and `FORCE ROW LEVEL SECURITY` conventions, but do not copy vocabulary RLS blindly because TOEIC content is shared/public while vocabulary is user-owned.

## 8. Media architecture proposal (not created)

Canonical DB value:

```text
bucket: toeic-test-media       # or existing bucket after explicit decision
media_folder: 2026/t1
relative path: 32-34.mp3
```

The effective object key is `2026/t1/32-34.mp3`. The browser receives a public URL or short-lived signed URL only at the media service boundary. Full project URLs must not be imported into database rows because they couple data to one Supabase project and make migrations/environments difficult.

The resolver added in Phase 1 is deliberately independent of bucket visibility. A future server/media service will choose public URL or signed URL based on the bucket policy. No bucket, policy or upload was created here.

## 9. Vocabulary integration proposal

Saving a vocabulary item from an explanation should reuse the current production flow, not a second vocabulary database:

1. UI selects a word and calls a parent/adaptor callback.
2. User selects an existing Collection and Section/Topic, or explicitly creates one through current modals.
3. Adaptor maps the explanation to the current `Vocabulary` input and calls `addVocabulary`/bulk flow.
4. Success/failure is reported by the existing toast/error pattern.

The prototype's automatic “create collection named after test / create Part topic” behavior is not recommended because it creates surprise containers and duplicates. No vocabulary integration was implemented in Phase 1.

## 10. Server scoring and autosave proposal

### Scoring

The future server RPC should be named `submit_toeic_attempt` (name subject to final API review). It must:

- verify the authenticated user owns the attempt;
- verify status/deadline and idempotency key;
- read answer keys server-side;
- compute per-question correctness, listening/reading totals and attempt status;
- return a deterministic result for a repeated submit key;
- ignore client-provided `correct_count`, `is_correct`, scaled score and score breakdown.

Scaled score should remain `null` or be deferred until an official, versioned conversion table is approved. The prototype's linear estimate is not an official TOEIC score and must not be used as a production score.

### Autosave

Production autosave should write `toeic_test_answers` to Supabase with:

- debounce/batching;
- unique `(attempt_id, question_id)` upsert semantics;
- retry using the same logical mutation key where applicable;
- stale attempt/user guard;
- unload handling limited to best effort;
- clear UI status for saved/pending/error.

`localStorage` may be used only as a short-lived unsent fallback if a later product decision requires it. It is not the source of truth and should not become a complex offline sync system in the first release.

## 11. Import pipeline proposal

Import should be a server-side script/job, not browser direct insert:

1. Read JSON and validate metadata, parts, option shape, counts, IDs and required fields.
2. Normalize part/section/passage/question records.
3. Convert full media URLs to `media_folder` + relative path using the Phase 1 resolver.
4. Verify exact question counts and passage group consistency.
5. Verify media filenames/extensions and produce a missing/duplicate report.
6. Insert in a transaction with explicit import idempotency key.
7. Keep content draft until review, then publish.

The importer must not infer passage grouping from question numbers, trust client score fields, or silently create vocabulary collections. No importer or database insert was created in Phase 1. Zod can be evaluated for the importer after adding it as a deliberate direct dependency; it is currently not a direct dependency.

## 12. Phased implementation plan

### Phase 1 — Audit and foundation (this task)

- audit routes/auth/services/storage/tests/prototype;
- document JSON contract and architecture;
- add typed domain boundary;
- add pure media resolver and unit tests.

### Phase 2 — Schema/RLS design review

- finalize table names/columns/statuses/indexes;
- decide answer-key separation;
- review RLS with security testing;
- create migration only after approval.

### Phase 3 — Server import and media validation

- build validated/idempotent import script;
- normalize paths and media report;
- add draft/publish workflow;
- upload or reconcile media outside client runtime.

### Phase 4 — Read services and server media boundary

- list published tests;
- load passages/questions without answer keys;
- add public/signed media resolver endpoint as decided;
- add service-level tests with mocked Supabase.

### Phase 5 — Attempt creation and autosave

- create user-owned attempts;
- save answers with unique constraints and stale guards;
- implement debounce/retry/idempotency;
- add resume behavior.

### Phase 6 — Exam/practice UI

- design production UI separately from prototype;
- use existing app shell/accessibility/toast conventions;
- add passage/media rendering only after data contract is stable.

### Phase 7 — Server submission/scoring

- implement and test authoritative submit RPC;
- handle repeated submit deterministically;
- defer official scaled score until table approval.

### Phase 8 — Explanation and vocabulary save

- add explicit Collection/Section selection;
- call current vocabulary service through an adaptor;
- avoid automatic duplicate containers.

### Phase 9 — Review/history/analytics

- attempt history and per-part review;
- aggregate metrics isolated from core test data;
- timezone/date rules aligned with existing local-date strategy.

### Phase 10 — Security/performance/accessibility hardening

- answer-key leakage checks;
- RLS negative tests;
- media cache/loading behavior;
- keyboard/mobile/audio accessibility;
- load and query performance review.

### Phase 11 — Release and migration operations

- production-like import dry run;
- backup/rollback plan;
- monitoring and error reporting;
- gradual publish and user acceptance test.

## 13. Risks and decisions still required

### High risk

- ETS/content licensing and whether media can be public;
- answer-key leakage through views, RLS, server components or cached payloads;
- long-running attempt/autosave behavior on suspended mobile tabs;
- imported explanations/vocabulary quality and untrusted rich text.

### Decisions required before Phase 2

- final route/tab name (`/app/tests` is the current recommendation);
- public versus private media bucket;
- use existing `mock-test-media` or create a dedicated bucket;
- exact import authority/admin workflow;
- whether answer keys live in a separate table;
- official scaled-score conversion policy;
- whether practice mode has different attempt/scoring semantics;
- how expired/in-progress attempts are recovered;
- whether explanation vocabulary requires explicit destination every time.

## 14. Verification and change boundary

Phase 1 verification should cover:

- unit tests for media path helpers;
- TypeScript compile and production build;
- lint and diff whitespace checks;
- no Supabase network calls from tests;
- no changes to existing SRS/RPC/queue/auth retry/request coordinator behavior.

Deferred intentionally after Phase 2:

- TOEIC route/navigation/UI;
- bucket creation and media upload;
- JSON importer and database writes;
- autosave and scoring RPC;
- prototype cleanup or deletion.

No files were staged, committed, pushed or deployed for this task.

## 15. Phase 2 implementation details

### Prototype build blocker

`prototype/ToeicCbtTest.tsx` imported `../public/data/ets2026_test1.json`, but that file does not exist. The prototype is reference code and is not imported by the production app dependency graph. The smallest safe fix was adding `prototype` to `tsconfig.json` `exclude`; no JSON copy, `@ts-ignore`, strict-mode change or prototype rewrite was used. The prototype remains in the repository for reference and is not deleted.

### Migration and database conventions reused

- Latest pre-Phase-2 migration: `20260804000000_harden_rating_idempotency_contract.sql`.
- New migration: `supabase/migrations/20260805000000_create_toeic_test_schema.sql`.
- Tables use UUID primary keys with `gen_random_uuid()`.
- Server timestamps use `TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
- Existing `public.set_updated_at()` is reused; no duplicate trigger function was created.
- Status/mode/section values use text CHECK constraints, matching the current repository convention rather than new PostgreSQL enums.
- RLS uses `ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY`.
- RLS helpers use `SECURITY DEFINER SET search_path = public, pg_temp`.
- Browser privileges are explicitly revoked from `PUBLIC`, `anon` and `authenticated` before granting only required read access.
- SRS idempotency remains unchanged: review log uniqueness is scoped by `(user_id, idempotency_key)` and the existing rating RPC remains untouched.

### Tables implemented

- `toeic_tests`: catalog metadata, publication status, media folder, question count and duration.
- `toeic_passages`: one row per passage with structured `content jsonb` using a documents array, plus transcript/translation/media paths.
- `toeic_questions`: client-safe question content, options, explanations, media paths and test/part/question ordering.
- `toeic_question_answer_keys`: separate server-controlled A/B/C/D answer key; no browser role grant or SELECT policy.
- `toeic_test_attempts`: user-owned attempt lifecycle, mode, status, selected parts, deadline and submit idempotency key foundation.
- `toeic_attempt_questions`: immutable attempt question snapshot with composite same-test/part invariants and stable position.
- `toeic_test_answers`: selected answer/flag/time state; `is_correct` exists for server output but is not directly writable by browser roles.

### Constraints and indexes

The migration validates non-empty names, year range 2000–2100, positive counts/duration/positions, valid status/mode/section values, safe media paths, object-shaped JSON, A/B/C/D option keys with at least A/B/C, valid selected parts with no duplicates, exam deadlines, submitted timestamps, non-negative time, same-test passage/question/attempt relationships and unique question/position ordering.

Indexes cover published catalog filtering (`status, set_name`), year/source, passage lookup by test/part, question lookup by test/part/number and passage/number, user attempt history/status/test, in-progress user/test lookup, and attempt question lookup by question. Primary/unique indexes are reused instead of adding duplicate indexes.

### Security model implemented

- Authenticated users can read only published tests, passages whose parent test is published and questions whose parent test is published.
- Anonymous users have no TOEIC table grants or policies.
- Draft and archived content is not readable through the authenticated client policy.
- Answer keys have RLS enabled/forced, no browser SELECT policy and no browser table grant.
- Users can read only their own attempts and child snapshot/answer rows.
- Attempt creation, snapshot creation, answer mutation and submit are intentionally reserved for future server/RPC boundaries in order to prevent direct changes to `user_id`, `test_id`, `is_correct` or submitted attempts.
- `is_toeic_test_published()` and `owns_toeic_attempt()` are minimal fixed-search-path SECURITY DEFINER helpers used by child-table policies.

### Verification status

The migration is designed for clean local `supabase db reset` and does not insert sample data, create buckets, publish tests or touch existing vocabulary/SRS tables. `supabase/tests/toeic_test_schema_verification.sql` checks catalog metadata, RLS flags, policies, grants and composite constraints without inserting data. RLS verification was executed against the local Supabase runtime and passed; it must not be inferred from SQL inspection alone.

## 16. Phase 3 importer implementation

### Runtime and command

The repository runs Node `v22.23.2`, has no `tsx`, `ts-node` or direct `pg` dependency, and uses npm scripts. The importer therefore runs as native TypeScript with Node's `--experimental-default-type=module --experimental-strip-types`; no runtime package or package version was added.

```text
npm run toeic:import -- --file prototype/2026-test-1-id_ad780150.json --dry-run
npm run toeic:import -- --file prototype/2026-test-1-id_ad780150.json --apply
npm run toeic:import -- --file prototype/2026-test-1-id_ad780150.json --apply --replace-draft
npm run toeic:import -- --file <file> --dry-run --media-dir <directory>
```

Dry-run is the default. `--apply` requires `SUPABASE_SERVICE_ROLE_KEY` and a local `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` (`localhost`, `127.0.0.1` or `::1`). The script refuses non-local targets and never logs the key. `--replace-draft` is valid only with `--apply`.

### Raw versus normalized boundary

The importer does not use production domain types for scraped input. It has separate `RawToeicTestFile`/`RawToeicQuestion` types, validates `unknown` at the JSON boundary, then produces `NormalizedToeicImport` containing:

- one draft test row;
- passage rows grouped by source `passage_id`;
- client-safe question rows with no answer key;
- separate answer-key rows;
- deterministic media manifest;
- warnings/errors and SHA-256 canonical source fingerprint.

Validation covers UUIDs, exact 200-question/count metadata, unique IDs/numbers, Part/section mapping, A/B/C/D option shape, non-null correct answer, passage IDs, media safety, explanation field types and critical top-level shape. The source anomaly `set_name = 2026` with `year = 2023` remains unchanged and is reported as a warning.

### Passage and vocabulary normalization

Passages are grouped once per `passage_id`, not once per question. Structured content uses the database contract `{ documents: [{ type, title, body }] }` and supports single/double/triple text without JSX/HTML rendering. Shared Part 3/4 audio/image is stored on the passage and removed from duplicate question media fields. Conflicting critical shared fields are errors; the known minor translation variation is reported as a warning and preserved deterministically.

`tu_vung` becomes `{ items, raw }`. The parser supports `Word (part of speech): Meaning`, multi-word phrases, Unicode Vietnamese text and raw fallback. It never calls a dictionary API or guesses malformed rows.

### Media manifest and local files

The existing `features/toeic-tests/mediaPath.ts` resolver is reused. The sample produces 54 audio objects and 11 image objects, sorted by relative object path. Each entry records kind, extension, question numbers and passage ID. The optional `--media-dir` check reports expected/found/missing/extra, duplicate basenames and zero-size files without reading media contents into memory. Missing files are warnings in dry-run and errors during apply; extra files remain warnings.

Default report artifacts are written under `reports/toeic/` (ignored by Git); `--report` can redirect the report and manifest elsewhere.

### Atomic apply and replacement policy

`supabase/migrations/20260805100000_create_toeic_import_rpc.sql` adds the server-only `import_toeic_test` RPC. The importer calls it through Supabase JS with the service role. The RPC runs one PostgreSQL transaction in this order: test → passages → questions → answer keys, then verifies expected counts. Any error rolls back the aggregate.

- New test ID: insert as `draft`.
- Existing draft: refuse by default.
- Existing draft with `--replace-draft`: replace only when no attempts exist.
- Published/archived test: always refuse.
- Existing attempts: replacement is refused.
- Source UUIDs are preserved.
- No sample is published and no attempt data is inserted.

The RPC is not executable by `anon` or `authenticated`; only `service_role` receives execute privilege. The source fingerprint is report metadata only; it was not added to the schema or misused as a security token.

### Phase 3 verification result

The sample dry-run completed with 200 questions, 42 passages, 200 answer keys, 54 audio objects, 11 image objects, zero errors and source warnings for the metadata year mismatch, one passage translation variation and one partially parsed vocabulary line. Local apply completed with `status = draft`; a follow-up query confirmed 1 test, 42 passages, 200 questions, 200 answer keys and 0 attempts. Re-running without `--replace-draft` was refused and the RPC transaction rolled back; `--replace-draft` then completed successfully.

No production bucket was accessed or uploaded to. UI, routes, attempt creation, autosave, scoring, signed URLs, importer admin page and vocabulary-save UI remain deferred.

## 17. Phase 4 safe reads and private media

Phase 4 moved browser content reads behind explicit catalog and part RPC
projections. Authenticated direct `SELECT` on `toeic_tests`,
`toeic_passages` and `toeic_questions` is revoked; the safe RPCs return no
answer key, transcript, translation, explanation or vocabulary fields. The
`toeic-test-media` bucket is private and has no browser storage policy.

The browser uses the existing Supabase singleton for safe RPC reads. A
server-only route validates the normal authenticated session and signs only
published-test media paths that are referenced by the database. Signed URLs
are short-lived and returned with `Cache-Control: private, no-store`.

See `docs/TOEIC_TEST_PHASE4_READ_SECURITY.md` for the audit and verification
details.

## 18. Phase 5 attempt lifecycle

Phase 5 adds server-authoritative attempt RPCs without implementing UI,
submission or scoring:

- `start_toeic_attempt` validates the authenticated user, published test,
  mode and selected parts, then chooses and snapshots questions in deterministic
  order. Exam attempts require Parts 1–7 and receive a server deadline;
  Practice attempts may use a subset and have no deadline.
- `save_toeic_attempt_answers` validates an owner, active/deadline state,
  snapshot membership, answer shape and a maximum batch of 50 before one
  atomic upsert. `is_correct` is never accepted as a write field.
- `get_toeic_attempt_session` returns the owner-only snapshot and safe answer
  state. It expires an overdue Exam attempt using server time before returning.
- `abandon_toeic_attempt` transitions only an owner `in_progress` attempt,
  preserves snapshots and answers, and is safe to call again after abandon.

Start idempotency uses the new `start_idempotency_key` and a unique
user/key index. A second start with the same key returns the same attempt. A
different key cannot silently reuse an active attempt: Exam conflicts are
per-user/test and Practice conflicts are per-user/test/selected-parts, both
returning the stable `DUPLICATE_ACTIVE_ATTEMPT` code. Autosave idempotency uses
the `toeic_attempt_mutations` ledger keyed by user/mutation key; a retry returns
the original saved result without repeating the upsert.

Browser roles have no direct attempt, snapshot, answer or mutation-ledger
table privileges. Existing RLS remains enabled/forced, while the RPCs use
fixed `search_path` SECURITY DEFINER functions and `auth.uid()` ownership
checks. Submit/scoring remains reserved for a later phase.

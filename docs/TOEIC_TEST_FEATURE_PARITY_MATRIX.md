# TOEIC Test Feature Parity Matrix

Audit scope: Phase 7.5, documentation-only. The matrix compares the prototype
under `prototype/` with the production TOEIC module under
`features/toeic-tests/`, `app/app/tests/`, `app/api/toeic-tests/`, and the
TOEIC migrations/tests. It is an acceptance checklist, not a declaration that
all prototype behavior should be copied to production.

Audit date: 2026-08-05

## Status model

Only these statuses are used:

- `COMPLETE` — the production behavior is present with an appropriate state,
  security boundary, and meaningful test or manual evidence.
- `PARTIAL` — the core behavior exists, but important prototype behavior or
  operational coverage is still absent.
- `MISSING` — no equivalent production behavior was found in the audited
  TOEIC flow.
- `REPLACED` — the need exists, but production intentionally uses a safer or
  more authoritative architecture.
- `REJECTED` — the prototype behavior must not be carried forward.
- `NOT_APPLICABLE` — outside the final product scope.
- `UNKNOWN` — a product, content, or operational decision is still required.

`COMPLETE` applies to the feature row as scoped. It does not mean that every
prototype convenience around that feature exists.

## Evidence boundaries

Prototype evidence is taken from the required source files, especially:

- `prototype/BAO_CAO_CHUC_NANG_DE_THI.md`
- `prototype/ToeicTestCatalog.tsx`
- `prototype/ToeicCbtTest.tsx`
- `prototype/PassageRenderer.tsx`
- `prototype/2026-test-1-id_ad780150.json`
- `prototype/VocabManager.tsx`
- `prototype/AddVocabModal.tsx`
- `prototype/ExcelImportModal.tsx`
- `prototype/excelUtils.ts`

Production evidence is taken from the actual routes/components/services/RPCs,
not from documentation alone. The principal evidence is:

- Catalog/overview: `app/app/tests/page.tsx`,
  `app/app/tests/[testId]/page.tsx`,
  `features/toeic-tests/components/ToeicTestCatalogPage.tsx`,
  `features/toeic-tests/components/ToeicTestOverviewPage.tsx`,
  `features/toeic-tests/services/toeicTestReadService.ts`.
- Workspace: `app/app/tests/attempts/[attemptId]/page.tsx`,
  `features/toeic-tests/components/ToeicAttemptWorkspace.tsx`,
  `features/toeic-tests/services/toeicAttemptService.ts`,
  `features/toeic-tests/services/toeicAutosaveController.ts`.
- Result/review: `app/app/tests/attempts/[attemptId]/result/page.tsx`,
  `app/app/tests/attempts/[attemptId]/review/page.tsx`,
  `features/toeic-tests/components/ToeicAttemptResultPage.tsx`,
  `features/toeic-tests/components/ToeicAttemptReviewPage.tsx`,
  `features/toeic-tests/services/toeicSubmissionService.ts`.
- Database/security: `supabase/migrations/20260805000000_create_toeic_test_schema.sql`,
  `20260805130000_create_toeic_attempt_lifecycle.sql`,
  `20260805140000_create_toeic_active_attempt_read.sql`,
  `20260805150000_create_toeic_submission_result_review.sql`, and the TOEIC
  SQL verification files.

## Phase 7 completion checkpoint

Phase 7 is `COMPLETE` for its declared scope, with official scaled-score
conversion explicitly deferred. Evidence found:

- `submit_toeic_attempt` scores from `toeic_question_answer_keys` inside a
  server-definer RPC and stores `submission_result`.
- `get_toeic_attempt_result` returns the stored owner-only result.
- `get_toeic_attempt_review` is owner-only and only allows submitted attempts.
- `ToeicAttemptWorkspace` flushes autosave before submit, retains the submit
  idempotency key, prevents concurrent submit through `submitBusy`, and routes
  to the result page after success.
- Result and review routes/components exist and map responses through
  `toeicSubmissionMapper.ts`.
- `supabase/tests/toeic_submission_verification.sql` verifies RPC existence,
  grants, answer-key isolation, and submit idempotency uniqueness.

Phase 7 does not include explanations, transcript/translation content joining,
vocabulary integration, analytics, or official score conversion. Those are
parity gaps or product decisions, not evidence that the Phase 7 server
submission contract is incomplete.

## Feature parity matrix

| ID | Category | Feature/Button | Prototype evidence | Production evidence | Status | Missing layers | Security class | Priority | Planned phase | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|---|
| TOEIC-CATALOG | Catalog | Published test catalog | `ToeicTestCatalog.tsx` test cards and static year/Part metadata | `ToeicTestCatalogPage`, `list_published_toeic_tests` | COMPLETE | — | PUBLIC_METADATA | P0 | 7 | Only published tests appear; loading/error/empty states work; test opens its overview. |
| TOEIC-FILTERS | Catalog | Year, set, source filters | Catalog year state and year pills in `ToeicTestCatalog.tsx:57-62,211-220` | Catalog form plus `toeicTestReadService.ts` filters | COMPLETE | — | PUBLIC_METADATA | P1 | 7 | Filters are server-backed, bounded, and retryable. |
| TOEIC-MODE | Selection | Exam/Practice selection | `ToeicTestCatalog.tsx` start modal; `BAO_CAO_CHUC_NANG_DE_THI.md` | `ToeicTestOverviewPage` mode controls | COMPLETE | — | SAFE_DURING_TEST | P0 | 7 | Exam forces all Parts; Practice selects one or more Parts. |
| TOEIC-PART-SELECTION | Selection | Selected Parts | Catalog modal Part buttons and select-all | Overview Part selection and count cache | COMPLETE | — | SAFE_DURING_TEST | P0 | 7 | Server receives only valid Parts and snapshots exactly the selected set. |
| TOEIC-START | Attempt | Start attempt | `onStartTest` in `ToeicTestCatalog.tsx:46-53` | `startToeicAttempt`, `start_toeic_attempt` | COMPLETE | — | SERVER_ONLY | P0 | 7 | Server validates published test, mode, Parts, ownership, deadline, and idempotency. |
| TOEIC-RESUME | Attempt | Resume active attempt | Prototype progress card/history state | `getToeicAttemptSession`, active-attempt read RPC, workspace route | COMPLETE | — | USER_PRIVATE | P0 | 7 | Reload returns the server snapshot and saved answers; closed attempts are not reopened. |
| TOEIC-AUDIO | Media | Play/pause/replay audio | `ToeicCbtTest.tsx:1766-1772,3115+`; prototype report audio behavior | `ToeicMediaView` signed media toolbar with play/pause, seek, loading/error/retry | PARTIAL | PRODUCT_DECISION, TEST | SAFE_DURING_TEST | P1 | 11 | Define Exam/Practice replay/seek policy and add browser tests; preserve signed-media boundary. |
| TOEIC-IMAGE | Media | Render question/passage image | `ToeicCbtTest.tsx` media JSX; fixture has `image_url` | `ToeicMediaView` signed image and alt text | COMPLETE | — | SAFE_DURING_TEST | P1 | 7 | Referenced image loads through the signing route and never exposes a public production URL. |
| TOEIC-PASSAGE | Workspace | Single/double/triple passage rendering | `PassageRenderer.tsx`; `ToeicCbtTest.tsx` passage fields | `ToeicPassageRenderer`, structured safe Part DTO | COMPLETE | — | SAFE_DURING_TEST | P0 | 7 | Passage structure and ordering match the snapshot; no unsafe HTML or answer key is rendered. |
| TOEIC-ANSWERS | Answer | A/B/C/D answer selection | `ToeicCbtTest.tsx:2856-2867` and answer JSX | `AnswerOptions` in `ToeicAttemptWorkspace` | COMPLETE | — | SAFE_DURING_TEST | P0 | 7 | Local selection is immediate, nullable answers are persisted by RPC, and no client correctness is calculated. |
| TOEIC-FLAG | Answer | Flag/unflag question | `flaggedMap` and `handleToggleFlag` at `ToeicCbtTest.tsx:1732,2869-2875` | Workspace flag control and autosave | COMPLETE | — | USER_PRIVATE | P1 | 7 | Flag state survives reload and appears in submit/review projections without changing scoring. |
| TOEIC-STRIKE | Answer | Strike-through option | Report and CBT option tools | No strike-through state/control in workspace | MISSING | UI, STATE, SERVICE, TEST | SAFE_DURING_TEST | P2 | 11 | User can toggle strike-through per option; it is ephemeral or explicitly persisted by product decision; keyboard/touch accessible. |
| TOEIC-PALETTE | Navigation | Question palette | `isPaletteOpen`, `paletteFilter`, palette JSX in `ToeicCbtTest.tsx:1746-1748,4291+` | `ToeicAttemptWorkspace` overlay palette with current/answered/unanswered/flagged filters | PARTIAL | TEST | SAFE_DURING_TEST | P1 | 11 | Palette supports current, answered, unanswered, and flagged filters without using correctness as a pre-submit signal. |
| TOEIC-PREV-NEXT | Navigation | Previous/Next | `handleNextQuestion`/`handlePrevQuestion` at `ToeicCbtTest.tsx:2903-2924` | Workspace previous/next buttons | PARTIAL | STATE, PRODUCT_DECISION, TEST | SAFE_DURING_TEST | P0 | 11 | Product-approved Listening restrictions are enforced consistently in UI and server/session flow. |
| TOEIC-KEYBOARD | Accessibility | Keyboard shortcuts | `ToeicCbtTest.tsx` keyboard handling and navigation | Workspace A-D/1-4, arrows, F shortcut | PARTIAL | UI, TEST | SAFE_DURING_TEST | P1 | 11 | Document and test the supported shortcut set; shortcuts are ignored in text controls and dialogs. |
| TOEIC-TIMER | Timing | Timer display | `timerSeconds`, preset, countdown at `ToeicCbtTest.tsx:1740-1744,2818-2836` | Server deadline plus `timer.ts` and workspace timer | PARTIAL | UI, STATE, TEST | SERVER_ONLY | P0 | 12 | Server deadline is authoritative; countdown handles refresh, expiry, background tab, and screen-reader announcement. |
| TOEIC-PAUSE | Timing | Pause attempt | `isTimerPaused` and pause control in prototype | No production pause control or server pause contract | MISSING | UI, STATE, RPC, DATABASE, PRODUCT_DECISION, TEST | SERVER_ONLY | P0 | 12 | Decide whether pause exists; if yes, define whether server deadline stops and enforce it server-side. |
| TOEIC-SUBMIT | Submission | Submit confirmation and finalization | `ToeicCbtTest.tsx` submit modal/handler | `ToeicSubmitDialog`, flush, `submit_toeic_attempt`, idempotent service | COMPLETE | — | SERVER_ONLY | P0 | 7 | Pending autosave flushes first; duplicate submit is safe; server scores and closes the attempt atomically. |
| TOEIC-RESULT | Results | Result summary | Prototype result modal and score view | Result route/component and stored result RPC | COMPLETE | — | USER_PRIVATE | P0 | 7 | Owner sees persisted raw totals, answered/unanswered, Listening/Reading counts, and can open review. |
| TOEIC-REVIEW | Results | Post-submit answer review | Prototype review mode | Owner-only review route/RPC plus `get_toeic_attempt_review_content`, `ToeicLearningContentPanel` | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | Submitted owner sees selected/correct/correctness/flag plus authorized explanation, shared passage learning content and vocabulary with Part filtering. |
| TOEIC-EXPLANATION | Practice | Explanation accordion | `ExplanationAccordion` at `ToeicCbtTest.tsx:1376`; report | `check_toeic_practice_answer`, `get_toeic_attempt_review_content`, `ToeicLearningContentPanel` | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | Practice explanation appears only after explicit check and saved answer; Exam receives it only after submit; loading/error/empty states are covered. |
| TOEIC-TRANSCRIPT | Practice | Audio transcript | `explanationSections.transcript` and fixture `transcript` field | Phase 8 learning RPCs and shared-passage panel | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | Transcript is absent from safe pre-submit DTOs, returned only for checked Practice question or submitted owner review, and rendered once per shared passage. |
| TOEIC-TRANSLATION | Practice | Translation | Prototype `dich_nghia` and explanation sections | Phase 8 learning RPCs and learning panel | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | Translation follows the same explicit-check/post-submit boundary and is mapped as plain text without unsafe HTML. |
| TOEIC-VOCAB-DISPLAY | Practice | Key vocabulary display | `tu_vung`, vocab accordion and lookup state in CBT | `ToeicLearningContentPanel`, runtime vocabulary mapper and learning RPCs | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | Authorized vocabulary items and raw fallback render in a semantic list; answer keys are not included in vocabulary content. |
| TOEIC-VOCAB-SAVE | Vocabulary | Save vocabulary from test/review | `handleSaveVocab` at `ToeicCbtTest.tsx:2943-2990`; `VocabManager` | `ToeicVocabularySaveDialog`, `toeicVocabularyAdapter`, existing vocabulary CRUD/RLS | COMPLETE | — | USER_PRIVATE | P1 | 8 | User explicitly selects an existing Collection/Section; duplicate normalized words are reported without insertion; no implicit container or SRS mutation. |
| TOEIC-NOTES | Tools | Notes per test/question/passage | Catalog localStorage notes and CBT notes drawer | No TOEIC notes table/service/UI | MISSING | UI, STATE, DATABASE, RLS, SERVICE, TEST | USER_PRIVATE | P1 | 10 | Scope, edit/delete, ownership, resume, and cross-device persistence are defined and tested. |
| TOEIC-ANNOTATIONS | Tools | Highlight/underline/draw/annotation | `AnnotatorOverlay`, annotation map and localStorage at `ToeicCbtTest.tsx:684,1774-1800` | No production annotation boundary | MISSING | UI, STATE, DATABASE, RLS, SERVICE, ACCESSIBILITY, TEST | USER_PRIVATE | P2 | 10 | Define annotation model/scope; keyboard and touch operations work; data remains owner-private. |
| TOEIC-LOOKUP | Tools | Dictionary/lookup | `handleLookupWord` and lookup drawer at `ToeicCbtTest.tsx:2321+` | No production lookup integration | MISSING | UI, SERVICE, SECURITY, PRODUCT_DECISION, TEST | USER_PRIVATE | P2 | 10 | Lookup uses a server-controlled adapter, handles rate/error states, and does not call an untrusted provider directly from the browser. |
| TOEIC-DICTATION | Practice | Dictation mode | `DictationCard`, fill mode and reveal controls at `ToeicCbtTest.tsx:98,316,1802+` | No production dictation state | MISSING | UI, STATE, SERVICE, TEST | SAFE_DURING_TEST | P2 | 10 | Practice-only mode has explicit answer/reveal semantics and does not affect Exam submission scoring. |
| TOEIC-FLIP | Practice | Flip words mode | `FlipWordsCard`, flip state at `ToeicCbtTest.tsx:201,452,1802+` | No production flip mode | MISSING | UI, STATE, TEST | SAFE_DURING_TEST | P2 | 10 | Practice-only flip interaction is isolated from attempt answer state and keyboard accessible. |
| TOEIC-WRONG-RETRY | Practice | Retry wrong questions | Catalog `onlyWrongQuestions` callback at `ToeicTestCatalog.tsx:46-53,374-425` | No wrong-question query or attempt creation flow | MISSING | UI, STATE, SERVICE, RPC, DATABASE, TEST | USER_PRIVATE | P1 | 9 | A submitted attempt creates a new Practice attempt from server-authorized wrong IDs; no client-provided arbitrary question set. |
| TOEIC-HISTORY | Analytics | Attempt history | `TestProgress.history` and history modal at `ToeicTestCatalog.tsx:30-43,69-74,735+` | No attempt-history route/RPC/UI | MISSING | UI, SERVICE, RPC, DATABASE, RLS, TEST | USER_PRIVATE | P1 | 9 | Owner-only paginated history shows latest/best attempts without answer-key leakage. |
| TOEIC-PROGRESS | Analytics | Test progress/completion | Prototype `progressMap`, attempted/correct/incorrect counts | No test progress aggregate in production catalog | MISSING | UI, STATE, SERVICE, RPC, DATABASE, TEST | USER_PRIVATE | P1 | 9 | Progress is derived from authoritative attempts/results, not localStorage, and never flashes fake zero. |
| TOEIC-RESET-PROGRESS | Analytics | Reset progress | `handleResetHistory` deletes localStorage progress at `ToeicTestCatalog.tsx:138-146` | No production reset/archive contract | MISSING | UI, SERVICE, RPC, DATABASE, PRODUCT_DECISION, TEST | USER_PRIVATE | P2 | 9 | Product decides reset vs archive; closed attempts/history semantics are explicit and recoverable. |
| TOEIC-SCORE-CALCULATOR | Results | Score calculator | Report and prototype score calculator control | No production calculator | MISSING | UI, STATE, TEST | SAFE_DURING_TEST | P2 | 9 | Calculator uses a declared, test-specific conversion policy and never fabricates an official score. |
| TOEIC-SCALED-SCORE | Results | Official scaled score | Prototype displays approximate/ETS-style score; Phase 7 returns `scaledScore: null` | `ToeicAttemptResultPage` explicitly says official conversion is deferred | UNKNOWN | PRODUCT_DECISION, CONTENT, SERVICE, TEST | SERVER_ONLY | P1 | 9 | Product/content owner approves official conversion source and version; server stores and returns the policy version. |
| TOEIC-RESPONSIVE | UX | Desktop/mobile workspace | Prototype responsive Tailwind layout | Workspace mobile-first two-column collapse | PARTIAL | ACCESSIBILITY, PERFORMANCE, TEST | SAFE_DURING_TEST | P1 | 12 | Verify all core controls at mobile widths, including horizontal Part navigation and dialogs, on Safari/Chrome device profiles. |
| TOEIC-A11Y | UX | Keyboard, focus, semantics, contrast | Prototype has controls but incomplete explicit semantics | Production native controls, focus rings, aria states, dialog focus management | PARTIAL | ACCESSIBILITY, TEST | SAFE_DURING_TEST | P1 | 12 | Component and manual audit verifies focus order, target size, announcements, non-color status, and screen-reader behavior. |
| TOEIC-AUTOSAVE | Attempt | Debounced answer/flag autosave | Prototype local `userAnswers`/`flaggedMap` state | `toeicAutosaveController`, RPC batch, mutation ledger | COMPLETE | — | USER_PRIVATE | P0 | 7 | Latest local state is batched, retry reuses key, late responses cannot roll back newer state, and reload reads server state. |
| TOEIC-OFFLINE | Reliability | Offline behavior | Prototype has no authoritative offline contract | No offline queue; failed autosave remains visible and retryable | MISSING | STATE, SERVICE, OPERATIONS, TEST | USER_PRIVATE | P2 | 12 | Decide whether unsent mutations are supported; if yes, namespace by user/attempt and never use local fallback as server history. |
| TOEIC-MEDIA-SECURITY | Security | Private media and signed access | Fixture uses public `mock-test-media` URLs | Private bucket, server signing service, API route, path authorization | COMPLETE | — | USER_PRIVATE | P0 | 7 | Browser receives only short-lived signed URLs for referenced media; no arbitrary path or public bucket access. |
| TOEIC-ANSWER-KEY-SECURITY | Security | Answer-key isolation | Fixture includes `correct_answer` on every one of 200 questions | Safe read DTO excludes it; submit/review RPC reads key server-side; browser grants revoked | COMPLETE | — | SERVER_ONLY | P0 | 7 | Pre-submit browser payload has no answer key/correctness; review only returns it after owner submission. |
| TOEIC-LOADING-ERROR | UX | Loading, empty, error, retry | Prototype has limited local modal states | Catalog/overview/workspace/result/review/media have explicit states and retries | COMPLETE | — | SAFE_DURING_TEST | P0 | 7 | Core loading does not render fake content; retry preserves attempt/answer state. |
| TOEIC-MULTI-TAB | Reliability | Multiple-tab behavior | Prototype localStorage maps can overwrite each other | Server mutation ledger protects batches; no full multi-tab coordinator | MISSING | STATE, SERVICE, PERFORMANCE, TEST | USER_PRIVATE | P2 | 12 | Decide supported behavior; stale tab writes must not corrupt newer answers or create duplicate submit/start actions. |
| TOEIC-LISTENING-RESTRICTIONS | Exam | Listening navigation restrictions | Report and `handlePrevQuestion`/`handlePartClick` lock Listening movement | Workspace currently has generic Previous/Next and Part navigation | PARTIAL | STATE, PRODUCT_DECISION, TEST | SAFE_DURING_TEST | P0 | 11 | Define exact Part 1–4 previous/seek/Part transition rules and enforce them consistently in Exam. |
| TOEIC-PRACTICE-FEEDBACK | Practice | Explicit correct/explanation feedback | `isPractice`, explanation state, locked answer at `ToeicCbtTest.tsx:2857-2867` | Workspace `Kiểm tra đáp án`, `check_toeic_practice_answer`, `ToeicPracticeFeedbackPanel` | COMPLETE | — | POST_SUBMIT_ONLY | P1 | 8 | A saved Practice answer requires explicit check; feedback locks answer until “Thử lại câu này”; Exam hides the control and cannot call the Practice RPC. |
| TOEIC-IMAGE-ZOOM | Media | Image zoom | Prototype image zoom controls at `ToeicCbtTest.tsx:3732,3841,4037` | `ToeicMediaView` signed-image lightbox with explicit close, click-outside and Escape | PARTIAL | ACCESSIBILITY, TEST | SAFE_DURING_TEST | P2 | 11 | Zoom/pan works on touch and keyboard, has an accessible close/reset, and does not re-request unauthorized media. |
| TOEIC-FONT-SIZE | UX | Reading font size | `fontSizeLevel` at `ToeicCbtTest.tsx:1763-1764,3814-3824` | No production font-size control | MISSING | UI, STATE, ACCESSIBILITY, TEST | LOCAL_PREFERENCE | P2 | 11 | Size changes apply only to reading content, persist only if product wants a local preference, and do not alter answer state. |
| TOEIC-MUTE | Media | Mute/volume | `audioVolume`/`isMuted` at `ToeicCbtTest.tsx:1766-1771,3692+` | `ToeicMediaView` has an explicit signed-media mute toggle | PARTIAL | PRODUCT_DECISION, TEST | SAFE_DURING_TEST | P1 | 11 | Define whether mute is allowed in Exam; control is keyboard/touch accessible and resets correctly per media policy. |
| TOEIC-AUDIO-SPEED | Media | Playback speed | `playbackSpeed` at `ToeicCbtTest.tsx:1768,3683+`; report 0.8/1.0/1.2/1.5 | `ToeicMediaView` cycles 1x/1.25x/1.5x without replacing the signed source | PARTIAL | PRODUCT_DECISION, TEST | SAFE_DURING_TEST | P1 | 11 | Product approves modes/speeds; changing speed does not restart audio; Exam policy and tests are explicit. |
| TOEIC-AUTOSUBMIT | Timing | Auto-submit at timeout | Prototype timer changes to review/modal at `ToeicCbtTest.tsx:2818-2836` | Production timer refetches session; user can submit expired Exam, no automatic submit | PARTIAL | UI, STATE, PRODUCT_DECISION, TEST | SERVER_ONLY | P0 | 12 | Decide auto-finalization; if enabled, server owns the transition and idempotent submit, not a client-only mode switch. |
| TOEIC-FREE-PREMIUM | Catalog | Free/premium access state | `is_free` in fixture and report/card intent | Catalog DTO has no access entitlement control | UNKNOWN | UI, SERVICE, RPC, PRODUCT_DECISION, TEST | CONTENT_ADMIN_ONLY | P1 | 12 | Product/auth entitlement source is defined; unauthorized users cannot start restricted tests. |
| TOEIC-MEDIA-LICENSE | Operations | Content/media distribution rights | Fixture includes external media URLs and source metadata | Private bucket and signing protect access but do not establish licensing | UNKNOWN | OPERATIONS, PRODUCT_DECISION, CONTENT | CONTENT_ADMIN_ONLY | P0 | 12 | Licensing owner approves storage/distribution for each source before production import or release. |
| TOEIC-VOCAB-AUTOCREATE | Vocabulary | Automatically create test Collection/Section | `ToeicCbtTest.tsx:2943-2977` calls `addCollection`/`addTopic` when absent | Production services support explicit CRUD, no TOEIC auto-create flow | REJECTED | SECURITY, PRODUCT_DECISION, TEST | USER_PRIVATE | REJECTED | 8 | Do not silently create containers; use explicit destination selection and existing vocabulary ownership/RLS. |
| TOEIC-CLIENT-SCORING | Security | Client-side scoring | Fixture exposes `correct_answer`; prototype review/client mode uses local answers | Server `submit_toeic_attempt` computes correctness from answer-key table | REJECTED | SECURITY | SERVER_ONLY | REJECTED | 7 | Never ship answer keys or accept client correctness; preserve server-authoritative scoring. |
| TOEIC-LOCAL-AUTHORITY | Persistence | Prototype localStorage as progress/notes/vocab authority | Catalog localStorage keys at `ToeicTestCatalog.tsx:76-133,138-177`; annotations at CBT lines 1785+ | Attempts/results/autosave are server-backed; local UI state is ephemeral | REPLACED | DATABASE, RLS, SERVICE | USER_PRIVATE | P0 | 7 | Server is authoritative for attempt/result/history; local storage is never used to reconstruct authoritative exam state. |
| TOEIC-SAFE-READ | Security | Safe question/content projection | Prototype passes rich question object to client | `list_published_toeic_tests`, `get_published_toeic_test_part`, runtime mappers | REPLACED | — | SAFE_DURING_TEST | P0 | 4 | Maintain explicit allowlisted DTOs with forbidden-field rejection and no answer-key/transcript leakage pre-submit. |
| TOEIC-PRIVATE-MEDIA | Security | Media URL access | Prototype JSON has public Supabase storage URLs | `toeicMediaService`, private bucket, `/api/toeic-tests/[testId]/media` | REPLACED | — | USER_PRIVATE | P0 | 4 | Keep service-role signing server-only, path/test authorization enforced, and signed URLs unpersisted. |
| TOEIC-RESULT-OWNER | Security | Owner-only result/review | Prototype has no server ownership boundary | Result/review RPCs validate `auth.uid()` and submitted status | COMPLETE | — | USER_PRIVATE | P0 | 7 | Other users receive stable errors and no result, review, answer key, or content leakage. |
| TOEIC-ABANDON | Attempt | Exit vs abandon | Prototype exit is client navigation; progress remains local | Workspace normal exit preserves attempt; abandon dialog calls RPC and preserves rows | COMPLETE | — | USER_PRIVATE | P0 | 7 | Exit is non-destructive; explicit abandon is owner-only, idempotent, and keeps snapshots/answers. |

### Matrix count

The feature matrix contains 60 audited feature rows. Counts below are derived
from the `Status` column above:

| Status | Count |
|---|---:|
| COMPLETE | 25 |
| PARTIAL | 9 |
| MISSING | 18 |
| REPLACED | 3 |
| REJECTED | 2 |
| NOT_APPLICABLE | 0 |
| UNKNOWN | 3 |
| **Total** | **60** |

## Prototype Button and Control Inventory

## Phase 9 status overrides

The following rows from the original Phase 7.5 inventory are superseded by
the Phase 9 implementation evidence below. The earlier rows are retained as
historical audit context; these overrides are the canonical acceptance status.

| ID | New status | Production evidence | Acceptance evidence |
|---|---|---|---|
| TOEIC-HISTORY | COMPLETE | `/app/tests/history`, `ToeicAttemptHistoryPage`, `list_toeic_attempt_history`, `toeicHistoryService`, `toeicHistoryMapper` | Owner-only deterministic pagination, filters, loading/empty/error/retry, result/review links and non-score closed-attempt states. |
| TOEIC-PROGRESS | COMPLETE | `get_toeic_test_progress`, catalog progress loading/summary, `ToeicTestProgressSummary` | Server-derived progress, Exam/Practice best values separated, active-attempt flag and no fake zero while loading. |
| TOEIC-WRONG-RETRY | COMPLETE | `start_toeic_wrong_question_attempt`, `ToeicWrongQuestionRetryButton` in result/history | Submitted owner source only; server selects incorrect answers; source immutable; retry key reuses the created attempt; empty set and active conflict have stable errors. |
| TOEIC-RESET-PROGRESS | COMPLETE | `toeic_test_progress_preferences`, `set_toeic_test_progress_visibility`, catalog hide/restore control | Visibility changes preserve attempts, answers, results and review history. |
| TOEIC-SCORE-CALCULATOR | REJECTED | No production calculator by approved DEC-10 policy | No unapproved 10–990 approximation or misleading raw-only calculator. |
| TOEIC-SCALED-SCORE | REJECTED | Result/history keep `scaledScore: null` | No official score is shown until source, version, test mapping and owner approval exist. |

### Phase 10 canonical counts

| Status | Count |
|---|---:|
| COMPLETE | 32 |
| PARTIAL | 11 |
| MISSING | 9 |
| REPLACED | 3 |
| REJECTED | 4 |
| NOT_APPLICABLE | 0 |
| UNKNOWN | 2 |
| **Total audited features** | **61** |

## Phase 10 status overrides

The earlier Phase 7.5/Phase 9 rows for the five learning-tool gaps are kept as
audit history. The following rows are the current acceptance status after the
Phase 10 implementation and evidence review.

| ID | Previous | New | Production evidence | Acceptance evidence |
|---|---|---|---|---|
| TOEIC-NOTES | MISSING | COMPLETE | `toeic_test_notes`, `get_toeic_notes`, `upsert_toeic_note`, `delete_toeic_note`, `toeicToolService`, `ToeicLearningToolsPanel` | Plain-text test/question notes, owner RPC boundary, explicit save/delete, reload service path, mapper/service tests, SQL privilege/RLS verification. |
| TOEIC-ANNOTATIONS | MISSING | PARTIAL | `toeic_text_annotations`, annotation RPCs, `toeicAnnotationAnchoring`, `ToeicAnnotatedText`, `ToeicLearningToolsPanel` | Question/passage targets, highlight/underline, quote+offset anchoring, stale-safe rendering, owner boundary and mapper/anchoring tests. Edit UI, overlap policy and full mobile/manual verification remain. |
| TOEIC-LOOKUP | MISSING | PARTIAL | `POST /api/toeic-tools/lookup`, `toeicDictionaryService`, `lookupToeicTerm`, `LookupTool` | Authenticated server route, bounded input, allowlisted DTO, no arbitrary URL/provider from browser, unavailable/retry UI and mapper/service tests. Provider integration is intentionally deferred. |
| TOEIC-DICTATION | MISSING | COMPLETE | `toeicDictation`, Practice-gated `DictationTool` in `ToeicLearningToolsPanel` | Transcript only after Phase 8 Practice feedback, normalized comparison/reveal/retry/clear, no answer or score mutation, pure tests. |
| TOEIC-FLIP | MISSING | COMPLETE | Practice-gated `FlipTool` in `ToeicLearningToolsPanel` and existing vocabulary save dialog | Front/back vocabulary card, keyboard/button semantics, ephemeral state reset per question, explicit vocabulary save, no SRS/answer writes. |

The updated canonical count is 32 COMPLETE, 11 PARTIAL and 9 MISSING; the
remaining 9 missing rows are Phase 11/12 controls or open product decisions.

The total is 61 because the Phase 9 history route and explicit visibility
control are tracked as separate acceptance behaviors in the addendum. The
original 60-row audit remains available above for traceability.

This inventory includes controls only when confirmed in the prototype source.
Controls are counted separately from the 60 feature rows.

| Control ID | Prototype location | Label/Icon | Accessible meaning | Triggered action | State changed | Production equivalent | Status | Decision |
|---|---|---|---|---|---|---|---|---|
| CTRL-01 | `ToeicCbtTest.tsx` header | Arrow/Exit | Leave current attempt | Navigate away | Route/local state | Workspace Exit | COMPLETE | Keep non-destructive exit. |
| CTRL-02 | `ToeicCbtTest.tsx` audio toolbar | Mute/volume | Mute audio | Change volume/mute | Audio state | None | MISSING | Define Exam rule first. |
| CTRL-03 | CBT audio player | Play/Pause | Play or pause audio | Media playback | Audio state | Native `<audio controls>` | PARTIAL | Add policy/custom control only after product decision. |
| CTRL-04 | CBT audio timeline | Seek | Move playback position | Set audio time | Audio state | Browser native seek | PARTIAL | Define Listening Exam seek restriction. |
| CTRL-05 | CBT audio toolbar | Speed | Change playback speed | Set playback rate | Audio state | None | MISSING | Phase 11 after policy. |
| CTRL-06 | CBT header | Timer | Read remaining time | Display countdown | Timer state | Server-clock timer | PARTIAL | Server deadline remains authority. |
| CTRL-07 | CBT header | Pause | Pause test | Pause timer/test | Timer/attempt state | None | MISSING | Open decision; no client-only pause. |
| CTRL-08 | CBT header/sidebar | Nộp bài | Finalize attempt | Open/confirm submit | Submit state | Submit dialog/RPC | COMPLETE | Preserve flush/idempotency. |
| CTRL-09 | CBT part bar | Part tabs | Select a Part | Change current Part | Current question | Workspace Part navigation | COMPLETE | Listening rules still need parity decision. |
| CTRL-10 | CBT footer | Câu trước | Go to previous question | Decrement question | Current question | Workspace previous | PARTIAL | Apply Listening rule. |
| CTRL-11 | CBT footer | Câu tiếp | Go to next question | Increment question | Current question | Workspace next | COMPLETE | Keep snapshot ordering. |
| CTRL-12 | CBT sidebar | Question palette | Jump to question | Set active question | Current question | `Palette` | PARTIAL | Add filters. |
| CTRL-13 | Answer group | A/B/C/D | Choose answer option | Set answer | Answer map | `AnswerOptions` | COMPLETE | No correctness before submit. |
| CTRL-14 | Question toolbar | Flag | Mark for review | Toggle flag | Flag map | Workspace flag | COMPLETE | Autosave through RPC. |
| CTRL-15 | Answer option menu | Strike-through | Mark option eliminated | Toggle option mark | Local option state | None | MISSING | Keep ephemeral unless product asks persistence. |
| CTRL-16 | Image toolbar | Zoom | Enlarge image | Change image scale | Image UI state | None | MISSING | Add accessible zoom dialog. |
| CTRL-17 | Reading toolbar | Font size | Increase/decrease reading text | Change font size | Local preference/UI | None | MISSING | Local preference, not attempt authority. |
| CTRL-18 | CBT tools | Auto-fill | Fill practice blanks | Populate practice state | Dictation/answer state | None | MISSING | Practice-only; no Exam shortcut. |
| CTRL-19 | Catalog/CBT drawer | Notes | Edit user note | Save note | Notes map | None | MISSING | Requires notes scope/RLS. |
| CTRL-20 | Catalog/CBT drawer | Vocabulary | View saved vocabulary | Open vocabulary drawer | Vocab map | No TOEIC equivalent | MISSING | Integrate explicit destination. |
| CTRL-21 | CBT lookup drawer | Lookup | Look up selected word | Call lookup handler | Lookup state | None | MISSING | Server adapter and provider policy required. |
| CTRL-22 | CBT toolbar | Annotate | Open annotation tools | Add/edit annotation | Annotation map | None | MISSING | User-private persistence required. |
| CTRL-23 | CBT tools | Dictation | Practice listening/writing | Enter/reveal dictation | Dictation state | None | MISSING | Separate from SRS and Exam answer. |
| CTRL-24 | CBT tools | Flip | Flip practice words | Toggle word side | Flip map | None | MISSING | Practice-only. |
| CTRL-25 | Result page | Review | View submitted answers | Open review route | Route | Result → review link | COMPLETE | Post-submit only. |
| CTRL-26 | Catalog card | Làm lại câu sai | Start wrong-question practice | `onStartTest(..., true)` | Local progress | None | MISSING | Requires server wrong-question flow. |
| CTRL-27 | Catalog card | Delete/reset history | Delete progress | Remove localStorage record | Progress map | None | MISSING | Decide reset/archive semantics. |
| CTRL-28 | Catalog card | History | Open attempt history | Open history modal | Modal state | None | MISSING | Add owner-only history read. |
| CTRL-29 | Prototype report | Score calculator | Estimate score | Calculate local score | Calculator state | None | MISSING | Avoid fake official score. |
| CTRL-30 | Catalog start modal | Thi thử/Luyện tập | Select mode | Set start mode | Modal mode | Overview mode buttons | COMPLETE | Server validates mode. |
| CTRL-31 | Catalog start modal | Select all Parts | Select all Parts | Set selected Parts | Modal Parts | Overview Part buttons | COMPLETE | Exam always all Parts. |
| CTRL-32 | Catalog card toolbar | Ghi chú | Open test note | Set active modal | Modal state | None | MISSING | Same as notes decision. |
| CTRL-33 | Catalog card toolbar | Từ vựng | Open test vocabulary | Set active modal | Modal state | None | MISSING | Same as vocabulary decision. |
| CTRL-34 | Excel modal | Download template | Download import template | Create `.xlsx` | No server state | Existing app vocabulary flow only | MISSING | Not part of test-taking route. |
| CTRL-35 | Excel modal | Choose file | Select spreadsheet | Parse file | Parsed rows | Existing vocab importer elsewhere | PARTIAL | TOEIC flow needs explicit integration decision. |
| CTRL-36 | Excel modal | Remove row | Remove parsed row | Delete preview row | Parsed rows | None | MISSING | Do not add as test workspace control. |
| CTRL-37 | Excel modal | Confirm import | Persist valid rows | Bulk add vocabulary | Vocabulary state | Existing `bulkCreateVocabularies` | PARTIAL | Use existing service and validation if integrated. |
| CTRL-38 | AddVocabModal | Add vocabulary | Save a word | Submit vocabulary form | Vocab data | Existing vocabulary CRUD | PARTIAL | TOEIC should reuse service, not duplicate it. |
| CTRL-39 | AddVocabModal | Create Section | Create destination | Submit topic form | Topic data | Existing topic CRUD | PARTIAL | Explicit user destination only. |
| CTRL-40 | Workspace | Autosave retry | Retry failed save | Re-send pending batch | Autosave state | `AutosaveIndicator` retry | COMPLETE | Reuse mutation key. |
| CTRL-41 | Workspace | Continue active | Resume active session | Push attempt route | Route | Overview active-attempt card | COMPLETE | No duplicate start. |
| CTRL-42 | Workspace | Abandon | Close attempt permanently | Confirm abandon RPC | Attempt status | `ToeicAbandonDialog` | COMPLETE | Preserve historical rows. |
| CTRL-43 | Workspace | Media retry | Retry media load | Re-sign URL | Media state | `ToeicMediaView` retry | COMPLETE | Keep private signing boundary. |
| CTRL-44 | Result/review | Back to catalog/result | Return to parent workflow | Navigate route | Route | Next links | COMPLETE | No dead-end in implemented flow. |
| CTRL-45 | Review | Part filter | Filter submitted review | Set Part filter | Review UI state | `ToeicAttemptReviewPage` Part buttons | COMPLETE | Filter does not affect server authorization. |
| CTRL-46 | Practice workspace | Kiểm tra đáp án | Explicitly request feedback for selected answer | Call practice feedback RPC | Feedback state | `ToeicPracticeFeedbackPanel` | COMPLETE | Disabled until answer save is not pending/error; hidden in Exam. |
| CTRL-47 | Practice feedback | Thử lại câu này | Reset feedback for current question | Clear ephemeral feedback | Feedback state only | Feedback panel reset | COMPLETE | Does not alter saved answer, review history, queue or SRS. |
| CTRL-48 | Learning vocabulary panel | Lưu từ | Open destination dialog for one vocabulary item | Select Collection/Section and save | Vocabulary state | `ToeicVocabularySaveDialog` + adapter | COMPLETE | No implicit destination, no automatic container creation, duplicate is explicit. |
| CTRL-49 | Vocabulary save dialog | Collection/Section selects | Choose existing owned destination | Load dependent Sections and save | Dialog state | Existing vocabulary services/RLS | COMPLETE | Empty/loading/error states are visible and focus is returned on close. |

## Behavior-level parity checks

| Behavior | Prototype behavior | Production behavior | Assessment |
|---|---|---|---|
| Audio | Custom playback state includes speed, volume, mute, progress and seek; report describes Listening lock rules. | Native audio controls use a short-lived signed URL. | Basic media works, but policy and control parity are `PARTIAL`. |
| Submit | Prototype changes local mode to review and opens a result modal when the local timer reaches zero. | Client flushes autosave, then server RPC scores and closes the attempt. | Client-only finalization is rejected; production is safer. Auto-submit remains an open decision. |
| Review | Prototype can display rich explanation, transcript, translation, answer analysis and vocabulary. | Production review loads owner-only answer review plus a separate submitted learning-content RPC; shared passage content is rendered once. | Phase 8 is complete for declared learning-content scope; advanced review navigation remains outside this phase. |
| Practice feedback | Prototype can reveal feedback from local Practice state. | Production requires saved answer + explicit check RPC; feedback is ephemeral and Exam cannot call the boundary. | Secure explicit feedback is implemented without exposing answer keys through safe reads. |
| Save vocabulary | Prototype auto-finds or creates a Collection and Part Section, then saves. | Production dialog requires explicit existing Collection/Section selection, checks normalized duplicate within Section, and calls current vocabulary CRUD. | Automatic creation is rejected; explicit save is complete. |
| Progress | Prototype combines hardcoded defaults and localStorage progress/history. | Production attempt/result state is server-backed; no catalog aggregate exists yet. | Prototype storage is not acceptable authority; history/progress are Phase 9. |
| Navigation | Prototype locks previous/Part movement in Listening Exam. | Production has Parts and previous/next but does not reproduce every lock rule. | `PARTIAL`; product rule must be made explicit before implementation. |
| Accessibility | Prototype uses many icon-only buttons and limited explicit semantics. | Production uses native buttons, focus rings, `aria-pressed`, labelled groups, and focus-managed dialogs. | Production is improved but needs device/screen-reader verification. |

## Persistence audit

| State | Prototype storage | Production storage | Current authority | Required final authority | Status | Gap |
|---|---|---|---|---|---|---|
| Answers | React state/localStorage-oriented prototype flow | `toeic_test_answers` through autosave RPC | Server for production attempt | SERVER_AUTHORITATIVE | COMPLETE | None for Phase 7 scope. |
| Flags | React `flaggedMap`, local progress | `toeic_test_answers.is_flagged` through autosave RPC | Server | SERVER_AUTHORITATIVE | COMPLETE | None for Phase 7 scope. |
| Notes | `vocabtoeic_cbt_notes_map` and CBT local note state | No TOEIC persistence | Prototype localStorage | SERVER_AUTHORITATIVE, user-private | MISSING | Notes table/RLS/service/UI. |
| Annotations | `vocabtoeic_cbt_annotations_${testId}` | No TOEIC persistence | Prototype localStorage | SERVER_AUTHORITATIVE, user-private | MISSING | Annotation model/RLS/service/UI. |
| Saved vocabulary | `vocabtoeic_cbt_vocab_map` plus prototype callbacks | Existing Supabase vocabulary tables/services through `toeicVocabularyAdapter` | Server vocabulary row with RLS | SERVER_AUTHORITATIVE | COMPLETE | Optional source metadata is intentionally not persisted because the existing vocabulary schema has no approved source column. |
| Current attempt | Prototype component state | `toeic_test_attempts` plus snapshot | Server | SERVER_AUTHORITATIVE | COMPLETE | None. |
| Test progress | `vocabtoeic_cbt_progress` and hardcoded defaults | No aggregate read | Prototype localStorage | SERVER_AUTHORITATIVE derived from attempts | MISSING | History/progress RPC and catalog UI. |
| Score | Prototype local result/modal and approximate score | `submission_result` stored by submit RPC; raw counts only | Server | SERVER_AUTHORITATIVE | COMPLETE | Official scaled score policy remains open. |
| Result | Prototype local modal | Stored submission result + owner read RPC | Server | SERVER_AUTHORITATIVE | COMPLETE | None for raw result. |
| History | Prototype `TestProgress.history` | No history read | Prototype localStorage | SERVER_AUTHORITATIVE | MISSING | Phase 9 history API/UI. |
| Wrong questions | Prototype derives from local incorrect count and callback | No server wrong-question selection | Prototype local state | SERVER_AUTHORITATIVE | MISSING | Phase 9 server-authorized new Practice attempt. |
| Current question | React state | React ephemeral state over server snapshot | Ephemeral UI | EPHEMERAL_UI_STATE | COMPLETE | Reset to valid snapshot position on resume. |
| Current Part | React state | React ephemeral state | Ephemeral UI | EPHEMERAL_UI_STATE | COMPLETE | No need to persist unless product asks. |
| Audio state | React state/localStorage not authoritative | Native media element + in-memory signed URL | Browser | EPHEMERAL_UI_STATE | PARTIAL | Define reset/replay/speed/mute policy. |
| Playback speed | React state | Not implemented | Prototype local state | LOCAL_PREFERENCE or EPHEMERAL_UI_STATE | MISSING | Phase 11 decision/control. |
| Mute | React state | Native media/browser state only | Browser | LOCAL_PREFERENCE or EPHEMERAL_UI_STATE | MISSING | Phase 11 decision/control. |
| Font settings | React state | Not implemented | Prototype local state | LOCAL_PREFERENCE | MISSING | Phase 11 local preference if desired. |
| Zoom setting | React state | Not implemented | Prototype local state | EPHEMERAL_UI_STATE | MISSING | Phase 11 control. |
| Catalog filters | React state | React state sent to read service | UI/service query | EPHEMERAL_UI_STATE | COMPLETE | No need to persist. |
| Import/publish state | Prototype hardcoded/import modal callbacks | Validated importer, atomic import RPC, admin workflow | Content admin/server | CONTENT_ADMIN_STATE | REPLACED | Keep admin/server boundary; not user workspace state. |

## Prototype behaviors rejected for production

| Prototype behavior | Evidence | Risk | Production replacement | Decision |
|---|---|---|---|---|
| Answer key shipped in browser question object | `prototype/2026-test-1-id_ad780150.json` has `correct_answer` for all 200 questions | Users can inspect the key before submit | Safe Part read RPC excludes key; submit/review RPC reads server-only key | REJECTED |
| Client-side scoring or local review finalization | `ToeicCbtTest.tsx:2818-2829` changes local mode/result on timer; prototype contains answer data | Scores can be forged and attempts can be finalized inconsistently | `submit_toeic_attempt` is server-authoritative and idempotent | REJECTED |
| Progress/history as localStorage authority | `ToeicTestCatalog.tsx:76-177` | Device-local, mutable, stale, no ownership/security | Server attempt/result/history projections | REJECTED |
| Notes/annotations treated as authoritative local data | Catalog/CBT localStorage keys | Lost across devices and not user-private on a shared device | Future owner-scoped tables/RLS | REJECTED |
| Automatic Collection/Section creation when saving a word | `ToeicCbtTest.tsx:2950-2977` | Unexpected data creation and duplicate containers | Explicit destination flow using existing vocabulary services | REJECTED |
| Public media URL as production authorization | Fixture `audio_url`/`image_url` values | Bypasses test entitlement and signed-media policy | Private bucket + server path authorization + signed URL | REJECTED |
| UI restriction as security boundary | Prototype Exam controls only | Devtools/client changes bypass it | Server status/deadline/RPC validation | REJECTED |
| Approximate TOEIC score presented as official | Prototype report/calculator intent | Misleading score and no stable conversion policy | Raw result now; official policy requires product/content decision | REJECTED |

## Production capabilities beyond prototype

| Capability | Production evidence | Product impact |
|---|---|---|
| Published-only catalog read boundary | `list_published_toeic_tests` and `get_published_toeic_test_part` | Draft content is not exposed. |
| Runtime sensitive-field rejection | `toeicTestMapper.ts`, `toeicAttemptMapper.ts`, `toeicSubmissionMapper.ts` | Malformed or over-rich RPC payloads fail closed. |
| Server-authoritative attempt snapshot | `start_toeic_attempt`, `toeic_attempt_questions` | Question order/membership cannot be changed by the browser. |
| Start/autosave/submit idempotency | Start key, mutation ledger, submit key and advisory locks | Retries/double-clicks do not duplicate logical mutations. |
| Resume from database | `get_toeic_attempt_session` | Reload/resume is cross-device server-backed. |
| Private media signing | `toeicMediaService.ts`, API route and private bucket | Media access is authorized per test/path and not publicly cached. |
| Server-side scoring and answer-key isolation | `submit_toeic_attempt`, `toeic_question_answer_keys` privileges | Correctness cannot be fabricated or inspected pre-submit. |
| Owner-only result/review | Result/review RPC ownership checks and SQL tests | One user cannot read another user's attempt. |
| Atomic validated importer | Import migration, importer validators and tests | Content is normalized and imported as a unit. |

## Route and workflow audit

### Prototype flow

The prototype flow is represented by local component callbacks:

```text
ToeicTestCatalog
  → start modal / Exam or Practice / selected Parts
  → ToeicCbtTest
  → local answer + flag + tool state
  → local submit/review/result modal
  → local notes/vocabulary/history/progress
```

The prototype has additional catalog shortcuts for wrong-question retry,
history, notes, and vocabulary. They are not server-authoritative.

### Production flow

```text
/app/tests
  → /app/tests/[testId]
  → /app/tests/attempts/[attemptId]
  → /app/tests/attempts/[attemptId]/result
  → /app/tests/attempts/[attemptId]/review
```

Observed route behavior:

- Catalog has a real back link to `/app`, server-backed filters, loading,
  error/retry, and empty states.
- Overview has a real catalog back link, mode/Part selection, active-attempt
  continuation, and start error/loading behavior.
- Workspace supports normal exit, explicit abandon, resume, Part navigation,
  answer/flag autosave, retry, submit confirmation, and closed-attempt states.
- Result links to review and back to catalog; it has a reload retry state.
- Review links back to result, filters by Part, and has a reload retry state.
- No dead-end was found in the implemented production flow. History, wrong
  retry, notes, vocabulary, and annotations do not yet have route equivalents.
- Production route labels are not fully identical to prototype labels; this is
  a UX parity difference, not a broken navigation contract.

## Mobile and accessibility audit

| Area | Evidence | Current finding |
|---|---|---|
| Desktop/mobile layout | Workspace uses responsive grid and mobile-first classes; Part bar is horizontally scrollable | Core flow is designed for both, but full device verification remains required. |
| Keyboard | Workspace handles A-D/1-4, arrows and F; ignores text controls/dialog | Good foundation; prototype tool shortcuts are not all present. |
| Screen reader semantics | Native buttons, `aria-pressed`, `aria-current`, labelled answer group, live autosave, image alt | Better than prototype; timer announcements and full screen-reader traversal need testing. |
| Focus management | Abandon/submit dialogs implement focus capture/return and Tab loop | Dialog foundation exists; route-level focus after navigation needs manual verification. |
| Color-only status | Palette uses current/answered/flagged styles and text context; review has icons with labels | Verify contrast and non-color distinction on actual themes. |
| Touch targets | Production primary buttons use roughly `min-h-10`/`min-h-11`; media native controls remain browser-dependent | Verify dense palette and Part navigation on small screens. |
| Audio accessibility | Native audio has an aria label and browser controls | Transcript/replay/speed/mute semantics are not yet present. |
| Image alternative | Question images receive question-specific alt text; passage media has component default alt | Verify meaningfulness for every imported media type. |

## Security classification highlights

| Data/behavior | Classification | Evidence |
|---|---|---|
| Catalog metadata | PUBLIC_METADATA or AUTHENTICATED_METADATA according to read RPC | Published catalog RPC. |
| Question text/options during attempt | SAFE_DURING_TEST | Safe Part DTO and runtime mapper. |
| Correct answer/correctness | POST_SUBMIT_ONLY / SERVER_ONLY | Submission/review RPC; answer-key table browser privileges revoked. |
| Transcript/translation/explanation | POST_SUBMIT_ONLY pending Phase 8 policy | Explicitly excluded from safe Part projection. |
| Attempt/answers/flags/results | USER_PRIVATE | `auth.uid()` ownership checks and RLS/RPC boundaries. |
| Media paths/URLs | USER_PRIVATE boundary | Private bucket and signing route. |
| Import/publish | CONTENT_ADMIN_ONLY | Import RPC/admin path; not a browser test-taking mutation. |
| Prototype answer key/public media | REJECTED_INSECURE | Fixture exposes both; production intentionally replaces them. |

## Gap prioritization

### P0

- Finalize Listening navigation/replay/seek and timeout policy before claiming
  full Exam correctness parity (`TOEIC-LISTENING-RESTRICTIONS`,
  `TOEIC-AUTOSUBMIT`, `TOEIC-TIMER`).
- Preserve answer-key isolation, server scoring, attempt ownership, deadline,
  and mutation idempotency while adding future content (`TOEIC-ANSWER-KEY-SECURITY`,
  `TOEIC-CLIENT-SCORING`, `TOEIC-MEDIA-SECURITY`).
- Resolve media licensing before production distribution (`TOEIC-MEDIA-LICENSE`).

### P1

- Post-submit explanation/transcript/translation and review content joining.
- Vocabulary display/save with explicit destination.
- History, progress, and wrong-question retry.
- Audio speed/mute policy and question palette filters.
- Mobile/accessibility verification and free/premium entitlement policy.

### P2

- Notes/annotations, lookup, dictation, flip, strike-through, image zoom,
  font size, offline/multi-tab decisions, and optional score calculator.

## Roadmap Phase 8–12

| Phase | Scope from this audit | Exit evidence |
|---|---|---|
| Phase 8 | Review content projection; explanation, transcript, translation; vocabulary display/save; explicit Collection/Section selection; duplicate/error states | Complete: owner-only learning RPCs, explicit Practice feedback, runtime mappers, vocabulary adapter, UI and local integration verification. |
| Phase 9 | Attempt history, test progress, score history, wrong-question list/retry, Part statistics, reset/archive semantics | Server-authoritative paginated reads, new Practice attempt from authorized wrong set, RLS/SQL/unit tests. |
| Phase 10 | Notes, annotations, user-private persistence, lookup, dictation and flip foundations | Tables/RLS/services, focus/mobile behavior, persistence/resume tests, no direct third-party browser API. |
| Phase 11 | Audio speed/mute/seek/replay rules, Listening restrictions, image zoom, font size, strike-through, palette filters, optional auto-fill/pause only after decisions | Product decisions closed; cross-browser component tests; Exam controls enforced by server where they affect correctness. |
| Phase 12 | Cross-browser/mobile UAT, accessibility, performance/load, media refresh, multi-tab/offline policy, licensing, monitoring and release checklist | UAT matrix, security verification, performance evidence, signed URL/error monitoring, release approval. |

No gap is scheduled as implementation without first resolving the product
decision rows in `docs/TOEIC_TEST_PRODUCT_DECISIONS.md`.

# TOEIC Test Phase 8 — Executive Parity Summary

Audit date: 2026-08-05

## Executive conclusion

The prototype and production TOEIC module are not at 100% parity. Production
has a secure, server-authoritative exam lifecycle and a working vertical slice,
but it intentionally does not yet include several prototype learning tools.

The counts below are calculated from the 60 feature rows in
`docs/TOEIC_TEST_FEATURE_PARITY_MATRIX.md`:

| Status | Count |
|---|---:|
| COMPLETE | 25 |
| PARTIAL | 9 |
| MISSING | 18 |
| REPLACED | 3 |
| REJECTED | 2 |
| NOT_APPLICABLE | 0 |
| UNKNOWN | 3 |
| **Total audited features** | **60** |

There are 49 confirmed prototype controls in the separate control inventory.
Control counts are not added to the feature total because multiple controls
belong to one behavior feature.

Parity conclusion: **not yet achieved**. The production core is ready for
server-authoritative start, resume, answer/flag autosave, submit, result and
owner-only review. Phase 8 learning content and explicit vocabulary save are
now complete for the declared scope; parity is still missing for
history/progress, notes/annotations, wrong-question retry and advanced CBT
controls.

### Most important P0/P1 gaps

- Listening navigation/replay/seek and timeout/auto-submit policy are not yet
  fully aligned with the prototype report.
- Attempt history, progress and wrong-question retry are absent.
- Audio speed/mute and palette filters are absent.
- Official scaled score, entitlement, and content licensing remain product or
  operations decisions.

## Phase 7 status

`PHASE_7_COMPLETE_FOR_DECLARED_SCOPE`.

Evidence:

- `supabase/migrations/20260805150000_create_toeic_submission_result_review.sql`
  defines `submit_toeic_attempt`, `get_toeic_attempt_result`, and
  `get_toeic_attempt_review`.
- `features/toeic-tests/services/toeicSubmissionService.ts` calls those RPCs
  through the browser Supabase singleton and maps stable errors.
- `features/toeic-tests/components/ToeicAttemptWorkspace.tsx` flushes pending
  autosave before submit, retains a submit key, blocks duplicate submission,
  and routes to the result page after success.
- `app/app/tests/attempts/[attemptId]/result/page.tsx` and
  `app/app/tests/attempts/[attemptId]/review/page.tsx` are present.
- `supabase/tests/toeic_submission_verification.sql` verifies function/grant,
  answer-key isolation and submit-idempotency invariants.
- Submission/result/review mapper tests exist under
  `features/toeic-tests/mappers/` and service tests under
  `features/toeic-tests/services/`.

Official scaled score conversion, analytics, notes and annotations remain
deferred. Phase 8 learning content does not alter vocabulary rating or SRS.

## Phase 8 status

`PHASE_8_COMPLETE_FOR_DECLARED_SCOPE`.

Evidence:

- `supabase/migrations/20260805160000_create_toeic_learning_content.sql`
  adds separate owner-authorized Practice and submitted-review RPCs. The
  existing safe Part read RPC remains unchanged.
- `features/toeic-tests/learningContracts.ts` and
  `features/toeic-tests/mappers/toeicLearningMapper.ts` validate learning DTOs,
  UUIDs, Parts, options, membership, duplicate IDs and unexpected fields.
- `ToeicPracticeFeedbackPanel` and `ToeicLearningContentPanel` require an
  explicit Practice check, show loading/error states, use accessible
  accordions and render shared passage content once in Review.
- `toeicVocabularyAdapter` and `ToeicVocabularySaveDialog` reuse current
  vocabulary services, require an existing Collection/Section, report
  normalized duplicates, and never create containers or call SRS.
- `supabase/tests/toeic_phase8_learning_verification.sql`, 127 passing unit
  tests and the local Test 1 integration flow verify the boundaries.

## Files audited

### Prototype

- `prototype/BAO_CAO_CHUC_NANG_DE_THI.md`
- `prototype/ToeicTestCatalog.tsx`
- `prototype/ToeicCbtTest.tsx`
- `prototype/PassageRenderer.tsx`
- `prototype/types.ts`
- `prototype/initialData.ts`
- `prototype/VocabManager.tsx`
- `prototype/AddVocabModal.tsx`
- `prototype/ExcelImportModal.tsx`
- `prototype/excelUtils.ts`
- `prototype/2026-test-1-id_ad780150.json`

The fixture contains 200 questions and includes `correct_answer` on all 200
questions, 100 audio references, 21 image references, and 69 transcript
values. It also contains public-looking storage URLs and rich fields that are
not all safe for a pre-submit browser projection.

### Production documentation

- `docs/TOEIC_TEST_ARCHITECTURE.md`
- `docs/TOEIC_TEST_PHASE4_READ_SECURITY.md`
- `docs/TOEIC_TEST_PHASE5_ATTEMPTS.md`
- `docs/TOEIC_TEST_PHASE6_UI.md`
- `docs/TOEIC_TEST_PHASE7_SUBMISSION.md`

### Production routes/components/services

- `app/app/tests/page.tsx`
- `app/app/tests/[testId]/page.tsx`
- `app/app/tests/attempts/[attemptId]/page.tsx`
- `app/app/tests/attempts/[attemptId]/result/page.tsx`
- `app/app/tests/attempts/[attemptId]/review/page.tsx`
- `app/app/tests/loading.tsx`
- `app/api/toeic-tests/[testId]/media/route.ts`
- All files under `features/toeic-tests/`, including the catalog, overview,
  workspace, passage/media components, dialogs, contracts, mappers, read,
  attempt, autosave, submission, media services, importer and tests.
- Vocabulary references audited: `services/vocabService.ts`,
  `services/vocabularyService.ts`, `services/collectionService.ts`, and
  `services/topicService.ts`.

### Migrations and SQL verification

- `supabase/migrations/20260805000000_create_toeic_test_schema.sql`
- `supabase/migrations/20260805100000_create_toeic_import_rpc.sql`
- `supabase/migrations/20260805120000_create_toeic_safe_read_boundary.sql`
- `supabase/migrations/20260805130000_create_toeic_attempt_lifecycle.sql`
- `supabase/migrations/20260805140000_create_toeic_active_attempt_read.sql`
- `supabase/migrations/20260805150000_create_toeic_submission_result_review.sql`
- `supabase/migrations/20260805160000_create_toeic_learning_content.sql`
- `supabase/tests/toeic_test_schema_verification.sql`
- `supabase/tests/toeic_attempt_lifecycle_verification.sql`
- `supabase/tests/toeic_phase6_ui_verification.sql`
- `supabase/tests/toeic_submission_verification.sql`
- `supabase/tests/toeic_phase8_learning_verification.sql`

## Prototype inventory

The audit inventory has 60 behavior features and 49 confirmed controls. The
main groups are:

- Catalog/selection: catalog, filters, mode, Parts, start, resume, access.
- Workspace: passage, image, audio, answers, flag, palette, navigation,
  keyboard, timer and submit.
- Practice tools: feedback, explanation, transcript, translation, vocabulary,
  lookup, dictation and flip.
- Personal learning: save vocabulary, notes, annotations, history, progress,
  wrong retry and reset.
- Security/persistence: autosave, media, answer key, owner boundary,
  localStorage replacement, offline and multiple tabs.
- UX/operations: responsive behavior, accessibility, score policy, licensing.

## Production inventory

The production implementation has evidence for:

- Catalog route and server-backed published catalog filters.
- Test overview route with Practice/Exam and Part selection.
- Server-authoritative start, snapshot, autosave, resume, active-attempt read,
  abandon, submit, result and review RPCs.
- Workspace answer/flag navigation, server-clock timer, media retry, submit
  confirmation and focus-managed dialogs.
- Explicit Practice feedback after autosave, post-submit learning content
  review, runtime learning mappers, and existing-vocabulary destination/save
  adapter.
- Runtime DTO mappers that reject sensitive fields.
- Private media signing API and private bucket boundary.
- Owner-only result/review and server-side scoring.
- Unit tests for mappers/services/cache/timer/autosave/media/importer/learning
  content and SQL
  verification for grants/RLS/answer-key/mutation invariants.

## Button/control coverage

Complete or substantially covered controls include start mode, Part selection,
start, resume active attempt, A-D answers, flag, Part navigation, next, submit,
submit confirmation, autosave retry, media retry, abandon, result and review
Part filter, explicit Practice check, feedback reset and vocabulary save
destination selection.

The most important missing/partial controls are:

- pause;
- mute, playback speed and explicit seek/replay policy;
- Listening navigation restrictions;
- palette filters;
- strike-through;
- image zoom and font size;
- notes, lookup, annotations, dictation and flip;
- wrong-question retry, history, reset progress and score calculator.

See the full 49-row inventory in the matrix for exact evidence and decisions.

## Security differences

Prototype risks found:

- The JSON fixture includes the answer key for every question.
- The prototype timer/review behavior is client-local.
- Progress, history, notes, annotations and test vocabulary use localStorage or
  local component state.
- Prototype media values look like public storage URLs.
- The vocabulary save path automatically creates a Collection and Section.
- Prototype UI restrictions cannot be a security boundary.

Production replacements found:

- Safe read RPCs and runtime field allowlists.
- Answer key read only inside server-definer submission/review RPCs.
- Server attempt snapshot, deadline, ownership, mutation ledger and idempotency.
- Private media bucket and server-only signed URL authorization.
- Owner-only result/review and direct mutation privilege revocation.

Remaining security/product work is primarily around future review content,
entitlement, licensing, notes/annotations, vocabulary destination, offline and
multiple-tab policy.

## Persistence differences

Production is server-authoritative for attempt, snapshot, answers, flags, submit
result and review. Current question/Part and media playback are ephemeral UI
state. Catalog filters are ephemeral UI state. Speed, mute, font and zoom are
not implemented and should not become attempt authority.

Notes, annotations, history, progress, wrong-question retry, and TOEIC
vocabulary integration still need server persistence or explicit reuse of the
existing vocabulary services. The prototype localStorage keys must not be
promoted as the production source of truth.

## Open product decisions

The decisions document records 22 open questions. The decisions that block the
next implementation phases are:

- Exam pause/deadline behavior;
- Listening seek/replay/speed/mute policy;
- Practice immediate feedback and answer-change rules;
- timeout auto-submit/finalization;
- official scaled-score policy;
- notes/annotation scope;
- vocabulary destination and duplicate behavior;
- wrong-question retry semantics;
- free/premium entitlement;
- media licensing and download policy;
- offline and multiple-tab support.

## Roadmap

- **Phase 8:** post-submit explanations, transcript/translation, vocabulary
  display/save and explicit destination flow.
- **Phase 9:** history, progress, wrong-question retry, Part statistics and
  reset/archive semantics.
- **Phase 10:** notes, annotations, lookup, dictation and flip with user-private
  persistence.
- **Phase 11:** advanced CBT controls: audio policy, speed, mute, seek/replay,
  Listening restrictions, zoom, font size, strike-through and palette filters.
- **Phase 12:** accessibility/mobile UAT, cross-browser behavior, performance,
  media refresh, offline/multi-tab policy, licensing, monitoring and release.

## Deliverables

Created in this audit:

- `docs/TOEIC_TEST_FEATURE_PARITY_MATRIX.md`
- `docs/TOEIC_TEST_PRODUCT_DECISIONS.md`
- `docs/TOEIC_TEST_PARITY_SUMMARY.md`

No runtime source, migration, RPC, route, UI component, schema or RLS file was
changed for Phase 7.5.

## Preservation confirmation

This audit did not change:

- vocabulary schema or vocabulary behavior;
- SRS formulas, queue/requeue, or `submit_vocabulary_rating`;
- importer semantics;
- safe read boundary;
- private media boundary;
- attempt lifecycle;
- submission/scoring contract;
- production runtime UI or navigation;
- database schema, migrations, or RLS.

## Quality gates

The Phase 7.5 changes are documentation-only. Quality commands were run after
the documentation files were created; the exact results are reported in the
final task response. No database reset is required because no SQL/runtime code
changed.

## Git status

Phase 7.5 has not staged, committed, pushed, or deployed anything. Existing
untracked files from before this audit were preserved. The final status output
must be checked to distinguish those pre-existing files from the three new
audit documents.

## Phase 9 canonical update

Phase 9 is complete for the declared history/progress/retry scope. The
canonical count is maintained in the Phase 9 addendum of the parity matrix:

| Status | Count |
|---|---:|
| COMPLETE | 29 |
| PARTIAL | 9 |
| MISSING | 14 |
| REPLACED | 3 |
| REJECTED | 4 |
| NOT_APPLICABLE | 0 |
| UNKNOWN | 2 |
| **Total audited features** | **61** |

The four Phase 9 behavior changes are: history, server-derived progress,
hide/restore progress visibility and wrong-question retry. Score calculator
and official scaled score are rejected for now under DEC-10. The original
Phase 7.5 counts remain above as historical traceability.

## Phase 10 canonical update

Phase 10 adds the learning-tools boundary without changing attempt answers,
submission/scoring, SRS or vocabulary behavior. The current canonical count is
maintained in the Phase 10 section of the parity matrix:

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

Notes, dictation and flip meet the Phase 10 acceptance scope. Annotations are
PARTIAL because edit/overlap UX and full device verification remain. Lookup is
PARTIAL because the server adapter is secure and deterministic but no approved
dictionary provider is configured.

## Phase 10.5 UI reconstruction update

`docs/TOEIC_TEST_PHASE10_5_UI_PARITY.md` records the presentation-only
prototype reconstruction. Catalog, workspace composition, signed media toolbar,
image lightbox and filtered question palette were brought closer to the
prototype without changing any attempt, answer, scoring or security contract.
The media and palette rows above remain PARTIAL until product policy and
browser/manual verification are completed; this update does not inflate the
canonical feature counts.

## Phase 11 implementation status

Phase 11 now has the client policy implementation and automated pure tests for
Listening navigation, media controls, shared passage identity, Part 1/2 Exam
presentation and Reading transition. The implementation deliberately does not
claim `COMPLETE` for the affected parity rows yet: Chromium, 390px viewport and
Mobile Safari manual evidence is still required for autoplay rejection,
seeking restoration, real media `ended` events and touch/palette behavior.

No canonical counts are changed until that manual evidence is recorded. See
`docs/TOEIC_TEST_PHASE11_LISTENING_CBT.md` and the Phase 11 addendum in the
feature matrix.

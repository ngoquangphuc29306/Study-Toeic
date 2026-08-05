# TOEIC Test Phase 7.5 — Executive Parity Summary

Audit date: 2026-08-05

## Executive conclusion

The prototype and production TOEIC module are not at 100% parity. Production
has a secure, server-authoritative exam lifecycle and a working vertical slice,
but it intentionally does not yet include several prototype learning tools.

The counts below are calculated from the 60 feature rows in
`docs/TOEIC_TEST_FEATURE_PARITY_MATRIX.md`:

| Status | Count |
|---|---:|
| COMPLETE | 18 |
| PARTIAL | 10 |
| MISSING | 24 |
| REPLACED | 3 |
| REJECTED | 2 |
| NOT_APPLICABLE | 0 |
| UNKNOWN | 3 |
| **Total audited features** | **60** |

There are 45 confirmed prototype controls in the separate control inventory.
Control counts are not added to the feature total because multiple controls
belong to one behavior feature.

Parity conclusion: **not yet achieved**. The production core is ready for
server-authoritative start, resume, answer/flag autosave, submit, result and
owner-only review. Prototype parity is still missing for post-submit learning
content, vocabulary integration, history/progress, notes/annotations, and
advanced CBT controls.

### Most important P0/P1 gaps

- Listening navigation/replay/seek and timeout/auto-submit policy are not yet
  fully aligned with the prototype report.
- Explanations, transcript, translation and vocabulary display/save are absent
  from the production TOEIC flow.
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

Official scaled score conversion, explanations, transcript/translation,
vocabulary/SRS integration, analytics, notes and annotations are explicitly
deferred and are not counted as Phase 7 defects.

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
- `supabase/tests/toeic_test_schema_verification.sql`
- `supabase/tests/toeic_attempt_lifecycle_verification.sql`
- `supabase/tests/toeic_phase6_ui_verification.sql`
- `supabase/tests/toeic_submission_verification.sql`

## Prototype inventory

The audit inventory has 60 behavior features and 45 confirmed controls. The
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
- Runtime DTO mappers that reject sensitive fields.
- Private media signing API and private bucket boundary.
- Owner-only result/review and server-side scoring.
- Unit tests for mappers/services/cache/timer/autosave/media/importer and SQL
  verification for grants/RLS/answer-key/mutation invariants.

## Button/control coverage

Complete or substantially covered controls include start mode, Part selection,
start, resume active attempt, A-D answers, flag, Part navigation, next, submit,
submit confirmation, autosave retry, media retry, abandon, result and review
Part filter.

The most important missing/partial controls are:

- pause;
- mute, playback speed and explicit seek/replay policy;
- Listening navigation restrictions;
- palette filters;
- strike-through;
- image zoom and font size;
- notes, vocabulary, lookup, annotations, dictation and flip;
- wrong-question retry, history, reset progress and score calculator.

See the full 45-row inventory in the matrix for exact evidence and decisions.

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

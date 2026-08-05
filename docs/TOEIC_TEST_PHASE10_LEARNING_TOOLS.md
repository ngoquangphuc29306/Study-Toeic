# TOEIC Test Phase 10 — Learning Tools

Status: implemented locally; not staged, committed, pushed or deployed.

## Scope and approved decisions

Phase 10 adds notes, text annotations, server-controlled dictionary lookup,
Practice dictation and Practice vocabulary flip cards. It does not change the
attempt answer, autosave, submission, scoring, result, history or wrong-retry
contracts.

- DEC-11: one plain-text note for a test and one plain-text note per question;
  passage-only notes are deferred.
- DEC-12: question/passage annotations are owner-private; MVP styles are
  highlight and underline with an optional short comment.
- Lookup uses a server adapter. No dictionary provider is currently configured,
  so the route returns a stable unavailable response rather than fake data or
  browser-side scraping.
- Dictation is Practice-only and consumes transcript only after the existing
  Phase 8 Practice feedback boundary is open.
- Flip is Practice-only, ephemeral and vocabulary-only; it has no relationship
  to SRS ratings, attempt answers or review logs.

## Database and security

Migration: `supabase/migrations/20260805180000_create_toeic_learning_tools.sql`.

`toeic_test_notes` stores `user_id`, `test_id`, optional `question_id`, plain
text content up to 5000 characters and timestamps. Partial unique indexes
enforce one test note and one question note per owner. The composite question
and test foreign key prevents a note from pointing at another test.

`toeic_text_annotations` stores the owner, test, exactly one question or
passage target, optional passage document index, start/end offsets, quote
snapshot, allowlisted style and short comment. Composite foreign keys enforce
target ownership by test. DOM selectors, XPath, arbitrary CSS/HTML and
freehand canvas data are not persisted.

Both tables have RLS enabled and forced, owner policies for all table
operations, and no direct authenticated table mutation grants. Browser
mutations use these RPCs only:

- `get_toeic_notes`, `upsert_toeic_note`, `delete_toeic_note`;
- `get_toeic_annotations`, `create_toeic_annotation`,
  `update_toeic_annotation`, `delete_toeic_annotation`.

RPCs use `auth.uid()`, validate published-test access and target/test
relationships, expose stable error markers and use a fixed `search_path`.
They never accept a client user ID and never touch attempt answers/results.

## Contracts and services

- `features/toeic-tests/toolContracts.ts` defines note, annotation, lookup and
  stable tool-error DTOs.
- `features/toeic-tests/mappers/toeicToolMapper.ts` rejects malformed rows and
  only accepts `highlight`/`underline` annotation styles and allowlisted lookup
  fields.
- `features/toeic-tests/services/toeicToolService.ts` validates UUIDs/content,
  uses the existing browser Supabase singleton and hides raw SQL errors.
- `features/toeic-tests/services/toeicAnnotationAnchoring.ts` resolves offsets
  and unique quote fallbacks without crashing on stale content.

## Notes UX

`ToeicLearningToolsPanel` exposes a compact “Công cụ học” group. Notes use an
explicit Save action so a failed note mutation never blocks answer autosave.
The UI has test/question scope, character count, loading, empty, error and
delete states. Notes are reloaded from the server when the scope/question
changes; localStorage is not used as authority.

## Annotation UX and anchoring

Question and passage text expose semantic `data-toeic-text-target` markers.
Selecting text creates a draft with target identity, document index, character
offsets and quote. The panel offers Highlight or Underline plus an optional
comment. Saved marks render with semantic `mark`/underline styles, so meaning
is not conveyed by color alone. If offsets no longer match, a unique quote
match is used; missing or ambiguous matches are treated as stale and skipped.

The current MVP includes create/delete and stale-safe rendering. Annotation
edit, overlap policy and full mobile long-press verification remain partial
follow-up work.

## Lookup

Route: `POST /api/toeic-tools/lookup`.

The route requires an authenticated Supabase user, accepts only `term` and an
optional short `context`, bounds both lengths, uses `private, no-store`, and
never accepts provider names, URLs or keys from the browser. The provider
interface is in `features/toeic-tests/server/toeicDictionaryService.ts`.
Because no approved provider/key exists in the project, it returns
`LOOKUP_UNAVAILABLE`. The UI still has empty/loading/no-result/error/retry and
explicit vocabulary-save states, ready for a future provider implementation.

## Practice tools

Dictation receives `feedback.transcript` only from the existing Practice
feedback DTO. `evaluateDictation` normalizes case, punctuation and whitespace,
then reports exact match, matching words, missing words and extra words. It
does not call AI, write an answer, alter score or persist typed transcript.

Flip displays `feedback.vocabulary.items`, provides button/keyboard semantics
through a native button, resets when the question changes and reuses
`ToeicVocabularySaveDialog` for explicit Collection/Section selection. No SRS
function or review log is called.

## UI/UX and animation

The installed skills were audited:

- `design-taste-frontend` — used for the calm, low-noise hierarchy and bounded
  tool density.
- `impeccable` — used for visible loading/error/disabled states, focus rings,
  dialog-compatible patterns and responsive polish.
- `ui-ux-pro-max` — used for progressive disclosure, one-tool-at-a-time mobile
  behavior, touch target sizing and semantic interaction guidance.
- `gsap-react` — read and available, but not used. CSS transitions are enough
  for the bounded panel and flip affordance; adding GSAP would add lifecycle
  complexity without meaningful UX value here. Existing dependency `gsap`
  remains untouched.

The tools are grouped instead of adding four large controls beside answers.
Native buttons, labelled textarea/input controls, `aria-live` save/results,
focus-visible rings, reduced-motion CSS fallback and no background/infinite
motion are used. A future modal/drawer expansion must preserve focus return and
mobile safe-area behavior.

## Tests and deferred work

Added unit coverage for:

- note/annotation/lookup runtime mapping and stable service validation;
- offset/quote matching, stale/ambiguous anchoring and safe segmentation;
- dictation normalization, exact matching and missing words.

Added SQL verification for table/RPC presence, owner policies and absence of
direct browser mutation privileges in
`supabase/tests/toeic_phase10_learning_tools_verification.sql`.

Local `npx supabase db reset` applies the Phase 10 migration successfully.
The repository has no established route-handler test convention and no
configured dictionary provider; route behavior is covered at the service and
mapper boundary, with provider integration intentionally deferred.

Not in Phase 10: audio speed, mute, seek/replay restrictions, Listening
navigation restrictions, image zoom, font size, strike-through, palette
filters, pause, auto-submit, offline, multi-tab coordination, entitlement and
licensing release workflow.

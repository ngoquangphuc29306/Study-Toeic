# TOEIC Test Phase 6 — Production UI vertical slice

## Scope

Phase 6 introduces the first production test-taking slice without changing scoring or submission:

```text
/app/tests
  → /app/tests/[testId]
  → /app/tests/attempts/[attemptId]
```

The existing `/app` shell and its `activeTab` state remain unchanged. The new routes are protected by the existing `/app/**` middleware boundary. The existing Navbar adds a real “Luyện đề” route entry and does not show a fake completion badge.

## Catalog and overview

- The catalog calls `list_published_toeic_tests` through `listPublishedToeicTests`.
- Year, set name, and source filters are sent to the existing read service.
- Loading, empty, unauthenticated/error, and retry states are explicit.
- Overview metadata comes from the published catalog DTO.
- Exam mode always sends all seven Parts to `startToeicAttempt`.
- Practice mode lets the user select one or more Parts.
- Every logical start creates one `crypto.randomUUID()` idempotency key.
- `DUPLICATE_ACTIVE_ATTEMPT` is handled by calling the new owner-only `get_active_toeic_attempt` read RPC and offering “Tiếp tục phiên”; the client never silently creates or abandons another attempt.

## Attempt workspace

The workspace resumes through `getToeicAttemptSession`. It handles `in_progress`, `expired`, `abandoned`, and `submitted` as separate states. Closed sessions are not reopened and Phase 6 does not submit or score them.

The session’s question snapshot is authoritative for order and membership. `buildToeicAttemptContentModel` joins snapshot refs to the safe Part payload by UUID, rejects missing/duplicate/wrong-test/wrong-Part content, and ignores extra safe content. It never receives or renders answer keys, correctness, transcripts, translations, or explanations.

Part payloads are cached only in memory by `testId:part`; concurrent reads are deduplicated and failed reads can be retried. The workspace loads the current Part on demand. Passage documents use plain trusted text with `whitespace-pre-wrap`; no HTML injection is used.

## Answer and flag interaction

- Selecting A/B/C/D updates local state immediately.
- Flag/unflag updates local state immediately.
- Palette state represents current, answered, unanswered, and flagged only; it never represents correctness.
- Arrow keys navigate, A–D or 1–4 select answers, and F toggles the flag.
- Shortcuts are ignored inside text controls and the abandon dialog.
- Normal exit keeps the attempt `in_progress`.
- Abandon requires confirmation and calls `abandonToeicAttempt`; answers and snapshot rows remain on the server.

## Autosave contract

`createToeicAutosaveController` is the local coordinator foundation:

1. Coalesce the latest mutation per question.
2. Debounce for 650 ms.
3. Send a batch of at most 50 rows through `saveToeicAttemptAnswers`.
4. Create one mutation key per logical batch.
5. Reuse that key when retrying the same failed batch.
6. Keep newer local edits in front of stale responses; a late response never rolls local state back.

There is no localStorage source of truth and no offline sync queue in this phase. A failed save remains visible as an inline non-blocking retry state, and the local answer is retained.

## Timer and media

- Exam time uses `deadlineAt` plus the server/client clock offset derived from `serverNow`.
- The browser updates the display once per second and makes answer mutations unavailable at zero.
- At zero, the client confirms state once through `getToeicAttemptSession`; it does not submit.
- Practice mode has no deadline.
- Media paths are resolved only through `/api/toeic-tests/[testId]/media` on demand.
- Signed URLs are cached in memory with a 45-second refresh buffer, never persisted or logged.
- Audio uses native controls and never autoplays. A media failure does not erase answer state.

## Accessibility and responsive behavior

The UI uses native buttons/links, visible `focus-visible` rings, `aria-pressed` for answer and flag state, `aria-current` for navigation, labelled answer groups, live status for autosave, meaningful image alt text, keyboard operation, and a focus-managed confirmation dialog. The layout collapses from a two-column desktop workspace to a mobile-first question flow without changing answer semantics.

## New server read boundary

`20260805140000_create_toeic_active_attempt_read.sql` adds only `get_active_toeic_attempt(uuid,text,smallint[])`. It is authenticated, owner-scoped, matches the exact test/mode/selected-part set, expires an overdue active attempt, and returns the existing safe attempt session JSON. Browser roles still have no direct table mutation privileges.

## Deferred work

Not implemented in Phase 6:

- submit;
- scoring and answer-key access;
- result/review screen;
- explanations or transcripts;
- vocabulary save/SRS integration;
- timer UI actions beyond display and mutation lock;
- production media upload;
- complex offline or multi-tab synchronization.

## Verification

Unit tests cover content joining, duplicate/missing content, part cache deduplication/retry, server-clock timing, media cache refresh, and autosave debounce/coalescing/retry-key reuse. SQL verification covers the active read RPC grant and the no-direct-mutation boundary.

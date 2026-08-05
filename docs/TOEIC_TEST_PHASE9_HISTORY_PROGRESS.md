# TOEIC Test Phase 9: History, Progress and Wrong-Question Retry

Date: 2026-08-05

## Scope

Phase 9 adds server-authoritative attempt history, catalog progress analytics,
owner-private progress visibility and wrong-question retry. It does not change
vocabulary/SRS, the attempt lifecycle, submission/scoring, safe content reads,
learning content, private media or unrelated production UI.

## Approved decisions

- DEC-10: raw result only. `scaledScore` remains `null`; no 10–990 estimate or
  score calculator is shipped without an approved conversion source/version.
- DEC-14: reset progress means hide/restore the progress summary. It never
  deletes attempts, answers, results or review history.
- DEC-15: wrong-question retry creates a new Practice attempt. The source
  submitted attempt remains immutable and the server selects incorrect rows.

The canonical decision status is recorded in
`docs/TOEIC_TEST_PRODUCT_DECISIONS.md` under the Phase 9 approval addendum.

## Database architecture

Migration: `supabase/migrations/20260805170000_create_toeic_history_progress_retry.sql`.

It adds:

- `toeic_test_attempts.wrong_retry_source_attempt_id` for source provenance;
- an index for retry provenance lookup;
- `toeic_test_progress_preferences` with owner-only RLS and no browser table
  privileges.

RPCs:

- `list_toeic_attempt_history(test, mode, status, limit, offset)` is
  authenticated, owner-scoped and deterministically ordered by
  `started_at DESC, id DESC`. Submitted scores come from stored
  `submission_result`; abandoned and expired attempts do not receive fake
  scores.
- `get_toeic_test_progress(test_ids)` aggregates attempts and stored results
  in one bounded query. It returns latest result, active-attempt state,
  submitted/abandoned/expired totals, completed Parts, hidden preference and
  separate best Exam/Practice values.
- `set_toeic_test_progress_visibility(test_id, hidden)` upserts one owner
  preference and never deletes history.
- `start_toeic_wrong_question_attempt(source_attempt_id, idempotency_key)`
  accepts only an owner submitted attempt. It selects `is_correct IS FALSE`
  server-side, preserves source snapshot order, creates a new Practice attempt
  atomically and does not copy old answers.

All RPCs use `SECURITY DEFINER`, a fixed `search_path`, `auth.uid()` and
authenticated-only execute grants. Browser roles cannot directly mutate the
preference table or attempt/snapshot/answer tables. The wrong-retry RPC never
accepts question IDs and never joins the answer key.

## Contracts and services

- `features/toeic-tests/historyContracts.ts` defines history items, progress
  summaries, filters, wrong-retry input and stable error codes.
- `features/toeic-tests/mappers/toeicHistoryMapper.ts` validates UUIDs, Parts,
  dates, nullable score fields, totals, pagination and forbidden sensitive
  fields. Unexpected `scaledScore` or answer-key fields are rejected.
- `features/toeic-tests/services/toeicHistoryService.ts` uses the existing
  browser Supabase singleton, validates input before RPC, maps raw database
  errors to stable codes and does not cache user-private history globally.

The idempotency key is created by the wrong-retry button at the start of one
logical action. A retry of the same request must reuse that key; a confirmed
new action gets a new key. The server stores the key in the existing
`start_idempotency_key` contract and records the source attempt separately.

## History and progress behavior

History supports Exam and Practice plus submitted, abandoned and expired
statuses. Only submitted attempts expose raw correct/listening/reading totals.
History does not expose `user_id`, answer keys, question content, transcript,
explanation or submission idempotency keys.

Progress uses server data only. Catalog metadata can render first, while
progress loads independently with a skeleton. Until the progress response is
successful, the catalog shows a loading placeholder rather than `0`. Exam and
Practice best values are displayed separately; a Practice `30/30` is never
called the best TOEIC score overall.

## Wrong-question retry flow

```text
submitted result/retry control
  → confirmation
  → start_toeic_wrong_question_attempt(sourceAttemptId, idempotencyKey)
  → server validates owner + submitted status
  → server selects is_correct = false rows
  → new Practice snapshot
  → workspace route
```

Unanswered questions are excluded in Phase 9. An all-correct source returns
`NO_WRONG_QUESTIONS`; an existing active Practice selection returns
`DUPLICATE_ACTIVE_ATTEMPT`. The old attempt and its result remain unchanged.

## UI/UX and accessibility

The history page is `/app/tests/history`. Desktop uses a filter row and a
stacked history list; mobile uses the same cards without forcing a wide table.
Controls have visible focus rings, text status labels, semantic navigation,
readable dates, loading/empty/error/retry states and touch-friendly targets.
The wrong-retry confirmation explains that the old attempt is preserved and
that the server chooses the questions.

The existing calm EasyTOEIC visual language is preserved. CSS transitions are
enough for this scope, so GSAP is not used. No chart, timer or celebration
animation was added; `prefers-reduced-motion` therefore has no new animation
surface to disable.

## Security verification

`supabase/tests/toeic_phase9_history_verification.sql` checks RPC existence and
grants, forced RLS, no direct preference-table access, source provenance and
server-selected wrong-answer behavior. Existing Phase 2–8 SQL verification
remains unchanged and must continue to pass.

## Deferred work

Phase 9 does not implement official scaled score, score calculator, notes,
annotations, dictionary, dictation, flip, audio speed/mute/seek/replay policy,
Listening restrictions, image zoom, font size, strike-through, pause,
auto-submit, offline or multi-tab coordination, entitlement or licensing.

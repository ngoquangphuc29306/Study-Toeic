# TOEIC Test Phase 5 — Attempt Lifecycle

## Scope

Phase 5 implements server-authoritative attempt creation, question snapshots,
answer autosave, resume and abandon. It does not implement catalog UI, exam
UI, timer UI, media playback, submission, scoring, answer review,
explanations, vocabulary save or analytics.

The following contracts remain unchanged: vocabulary/SRS, rating RPC, importer,
safe read RPCs, private media bucket, signed media route and existing UI.

## Lifecycle

```text
start_toeic_attempt
  → validate auth/test/mode/parts
  → server selects questions
  → create attempt and snapshot atomically
  → return safe attempt session

answer changes
  → local caller batches pending states
  → save_toeic_attempt_answers
  → atomic answer upsert + mutation-ledger result

reload/resume
  → get_toeic_attempt_session
  → expire overdue Exam attempt if necessary
  → return snapshot and saved answers

abandon_toeic_attempt
  → in_progress → abandoned
  → preserve attempt questions and answers
```

Allowed state transitions are `in_progress → abandoned`,
`in_progress → expired`, and a future Phase 7
`in_progress → submitted`. Closed states cannot be reopened by Phase 5.

## Start rules

`start_toeic_attempt` requires:

- authenticated `auth.uid()`;
- a published test;
- mode `exam` or `practice`;
- non-empty, unique Parts 1–7;
- a UUID start idempotency key.

Exam requires exactly `[1, 2, 3, 4, 5, 6, 7]`. Its deadline is calculated from
the server `clock_timestamp()` and the published test duration. Practice may
select a subset and has `deadline_at = null`.

The server selects questions from `toeic_questions` and orders them by
`position`, `question_number`, and `id`. The client cannot submit question IDs,
`user_id`, `test_id`, `deadline_at`, total count or status. Snapshot insertion
and count verification are in the same database transaction.

There is at most one active Exam per user/test. Practice allows multiple
histories but at most one active attempt for the same user/test/selected-parts
array. A different start key receives `DUPLICATE_ACTIVE_ATTEMPT`; it is never
silently attached to another logical start action. Reusing the same start key
returns its original attempt.

## Autosave

`save_toeic_attempt_answers` accepts a batch of 1–50 rows. Each row contains:

- `questionId`;
- nullable `selectedAnswer` (`A`–`D`);
- `isFlagged`;
- nullable `answeredAt`;
- nullable non-negative `timeSpentSeconds`;
- `clientMutationId`.

The RPC verifies owner, `in_progress` status, server deadline and membership
in `toeic_attempt_questions` before one atomic upsert. It never accepts or
writes `is_correct`. Invalid rows, duplicate questions, questions outside the
snapshot and expired attempts reject the entire batch.

The `toeic_attempt_mutations` ledger stores the result of each logical batch
under `(user_id, mutation_key)`. A retry with the same key returns the stored
result before checking or repeating writes. The ledger is server-owned and has
no browser table privileges or policies.

`batchToeicAnswerMutations` is a pure client utility. It keeps the latest local
state for each question and chunks at 50 rows. It does not persist answers,
create retry keys, or become a source of truth. A future UI can debounce the
utility at 500–800 ms without introducing a global context or offline sync.

## Resume and deadline

`get_toeic_attempt_session` checks ownership and returns only attempt metadata,
question references, saved answer state, `serverNow`, and
`remainingSeconds`. It does not return question content or answer keys; safe
Part RPCs remain the content source.

For Exam, an overdue `in_progress` attempt is changed to `expired` in the same
server-side flow and returns zero remaining seconds. Autosave then returns
`ATTEMPT_EXPIRED`. Practice has no deadline.

## Abandon

`abandon_toeic_attempt` is owner-only. An active, non-expired attempt becomes
`abandoned` with a server timestamp. Repeating abandon on an already abandoned
or expired attempt is safe and returns its current state. Attempts,
snapshots and answers are never deleted.

## Error contract

The browser service maps raw RPC errors to stable codes:

`UNAUTHENTICATED`, `INVALID_INPUT`, `TEST_NOT_FOUND`, `TEST_NOT_PUBLISHED`,
`ATTEMPT_NOT_FOUND`, `ATTEMPT_NOT_OWNED`, `ATTEMPT_NOT_ACTIVE`,
`ATTEMPT_EXPIRED`, `QUESTION_NOT_IN_ATTEMPT`, `DUPLICATE_ACTIVE_ATTEMPT`,
`SAVE_FAILED`, `READ_FAILED`, and `INVALID_RESPONSE`.

Raw PostgreSQL messages, answer data, user IDs and secrets are not logged or
returned by the service.

## Security

The new migration revokes browser `SELECT` on attempt, snapshot and answer
tables in addition to the Phase 4 content boundary. Browser roles have no
`INSERT`, `UPDATE` or `DELETE` privileges on attempt data and no access to the
mutation ledger. RPCs use fixed `search_path`, `SECURITY DEFINER`, and
`auth.uid()` checks. Existing answer-key isolation remains intact.

## Deferred work

- catalog and test-taking UI;
- timer/audio/image interaction;
- submit and scoring RPCs;
- answer review and explanations;
- vocabulary/SRS save;
- wrong-question practice, analytics, notes and annotations;
- production media upload.

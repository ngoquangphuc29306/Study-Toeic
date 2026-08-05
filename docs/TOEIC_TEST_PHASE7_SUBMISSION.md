# TOEIC Test Phase 7 — Submission, Scoring and Review

## Scope

Phase 7 adds the server-authoritative finalization path for a TOEIC attempt. It
does not change the vocabulary/SRS flow, the existing attempt start/autosave/
resume/abandon RPCs, the importer, the safe content-read RPCs, the media
signing boundary, or the database schema used by those unrelated features.

Official scaled scoring is intentionally deferred. The result contract returns
`scaledScore: null` and exposes raw counts only.

## Lifecycle

```text
in_progress
    ├── autosave answers/flags (server validates snapshot membership)
    ├── submit_toeic_attempt
    │       ├── score against server-only answer keys
    │       ├── update toeic_test_answers.is_correct
    │       └── persist canonical submission_result
    ├── abandon_toeic_attempt → abandoned
    └── server deadline handling → expired (Exam only)

expired (Exam)
    └── submit_toeic_attempt → submitted

submitted
    ├── get_toeic_attempt_result
    └── get_toeic_attempt_review
```

Practice attempts have no deadline. An expired Exam may finalize answers
already persisted before the deadline; no new answer autosave is accepted
after expiry. Abandoned attempts cannot be submitted.

## Submit contract

The browser calls `submit_toeic_attempt(attemptId, idempotencyKey)`. The RPC:

1. authenticates with `auth.uid()`;
2. serializes the logical user/key pair with a transaction advisory lock;
3. locks the attempt row and verifies ownership and submit-eligible status;
4. verifies that every snapshotted question has an answer key;
5. computes `is_correct` only on the server;
6. builds the raw result summary from the snapshot and persisted answers;
7. atomically changes the attempt to `submitted` and stores the summary.

The client never sends a correct answer and never calculates correctness,
section totals, or result counts. An incomplete answer key aborts the
transaction before the attempt is submitted.

## Idempotency and concurrency

The submit key is created once when the user opens the submit action and is
kept in the workspace component until the action is confirmed or the attempt
is abandoned/unmounted. A retry uses the same key. A repeated request with the
same key returns the canonical stored result. A key already associated with a
different attempt returns `SUBMIT_IDEMPOTENCY_CONFLICT`.

The attempt row lock and the user/key advisory lock serialize concurrent
submits. Therefore a double click, keyboard repeat, network retry, or tab race
cannot create a second review or a second submission result.

## Autosave boundary before submit

The submit dialog does not call the submit RPC until the autosave controller
has flushed pending batches. A failed flush keeps the dialog open and exposes
the existing retry pattern; the attempt is not submitted with an uncertain
answer state. The controller preserves the mutation key for a failed batch,
so retrying that batch is idempotent.

After the submit RPC succeeds, the workspace navigates to the result route and
does not roll back local answers or attempt state. Autosave is no longer
accepted because submitted attempts are closed.

## Safe result and review projections

`get_toeic_attempt_result` returns only the owner’s stored summary: total,
answered, unanswered, correct, incorrect, listening and reading raw counts,
mode, status, submitted timestamp and `scaledScore: null`.

`get_toeic_attempt_review` is owner-only and requires `submitted` status. It
returns the snapshot question reference, selected answer, correct answer,
correctness and flag state. It does not return transcript, translation,
explanation, vocabulary content or other question content.

The TypeScript mapper validates UUIDs, dates, counts, answer options, status,
and total invariants. It rejects forbidden response keys and converts raw RPC
errors to stable `ToeicSubmissionError` codes without exposing PostgreSQL
messages.

## Error behavior

The submission service distinguishes authentication, ownership, lifecycle,
idempotency, answer-key completeness, read and generic submission failures.
The submit dialog keeps retryable errors visible without changing the layout.
The result and review pages show a non-sensitive error state and allow the user
to return to the test catalog.

## Security invariants

- Answer keys remain in `toeic_question_answer_keys` and are read only inside
  server-definer RPCs.
- Browser roles have no direct answer-key read or answer mutation boundary.
- `is_correct` is not accepted in autosave input and is updated only by the
  submit RPC.
- Ownership is checked with `auth.uid()` for submit, result and review.
- A client cannot choose the answer key, alter the deadline, or submit another
  user’s attempt.
- The stored submission result is the source of truth for repeat reads.

## Files

- `supabase/migrations/20260805150000_create_toeic_submission_result_review.sql`
  adds submit, result and review RPCs.
- `supabase/tests/toeic_submission_verification.sql` verifies grants, RLS and
  direct-mutation restrictions.
- `features/toeic-tests/submissionContracts.ts` defines DTOs and stable errors.
- `features/toeic-tests/mappers/toeicSubmissionMapper.ts` validates RPC data.
- `features/toeic-tests/services/toeicSubmissionService.ts` is the browser
  service boundary.
- `features/toeic-tests/services/toeicAutosaveController.ts` exposes an async
  flush result so submit can require a successful final autosave.
- `features/toeic-tests/components/ToeicSubmitDialog.tsx` provides the existing
  style’s confirmation/error interaction.
- `features/toeic-tests/components/ToeicAttemptResultPage.tsx` and
  `ToeicAttemptReviewPage.tsx` provide result/review routes without changing
  the existing workspace layout.

## Deferred work

Official scaled-score conversion, answer explanations, transcript/content
joining for review, submission analytics and vocabulary/SRS integration remain
outside Phase 7.

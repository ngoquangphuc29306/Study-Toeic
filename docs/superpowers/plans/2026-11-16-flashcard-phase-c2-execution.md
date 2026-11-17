# Flashcard Phase C2 — Execution evidence

Implementation worktree: `E:/worktrees/flashcard-phase-c2`, branch `flashcard-phase-c2`.
Baseline and unchanged local main: `ca8c096413a6292324ea1c09bf2664f38d76467d`.
Status: C2.1 characterization/review in progress; no production refactor started.

## Environment and safeguards

Windows, Node 24, Next 15.5.29, React 19, existing lockfile restored by npm ci without manifest changes. Initial free space: E 240,435,556,352 bytes; D 59,383,328,768 bytes. New files, dependencies, Next output, npm cache, TEMP/TMP and browser artifacts are on E:. Existing Playwright binaries on D: were reused. Existing C: worktrees were untouched. No commits, push, merge or deployment.

Local smoke used existing authorized accounts and existing isolated Supabase Docker at `127.0.0.1:55421`, with browser external Supabase domains blocked. No reset, migrations or data deletion. One local rating was saved; test records retained. Credentials are not included in this report.

## Baseline verification

- Production source unchanged. 55 added characterization tests initially gave 111 focused passes.
- Full suite after those additions: 541 passed, six known failures, one intentional bundle skip. Five progressService batching failures (TEST 4/5/6/7/9), plus appDataService "still rejects when core data fails". The latter expects aggregates not to start and conflicts with the existing concurrent-loading contract. Assertions were preserved.
- Lint exit 0: three existing image warnings and ESLintIgnoreWarning. Typecheck exit 0.
- Complete baseline build exit 0; post-build bundle test passed. Baseline initial /app: 11 chunks, 880,621 raw / 250,175 gzip bytes; SheetJS absent. Build uses local-only public placeholders.
- Authenticated local browser: Flashcard, Quiz, Typing Enter and Pronunciation UI passed; actual microphone untested. Rating: 0 Auth getUser requests, 1 RPC, review logs +1, review_count +1. Session reload restoration, logout redirect and disjoint account data passed. No page errors/external Supabase requests observed.
- Eight desktop/mobile authenticated screenshots and eight deterministic fixture screenshots saved. Fixture views inspected; no after-refactor comparison exists yet.

## Browser measurements (baseline only)

Headless Chromium, Next development, real Flashcard component with controlled in-memory fixture; 1 warmup plus 5 measured samples per size. Zero-delay mock persistence. Includes navigation/automation/dev overhead; not production responsiveness or network latency evidence. Isolated repeat is the comparison baseline.

| Vocabulary count | Initialization median ms | Rating-to-next median ms | Rating subtree commits |
|---|---:|---:|---:|
| 100 | 1092.7 | 76.1 | 3 |
| 1,000 | 962.6 | 83.3 | 3 |
| 5,000 | 782.4 | 90.5 | 3 |

Non-monotonic initialization demonstrates noise/warm-cache sensitivity. No performance improvement claimed.

Detailed evidence and reproducible harnesses: `E:/EasyToeicC2/artifacts/`, `E:/EasyToeicC2/profile.cjs`, `E:/EasyToeicC2/ui-baseline.cjs`, `E:/EasyToeicC2/auth-smoke.cjs`. Temporary profiling route moved outside the repository before the final baseline build.

## Independent C2.1 review

Reviewer identified three test gaps: actual rapid double submission, stale speech callbacks hidden by subsequent reset, and context changes during pending rating. Corrections/reproduction are in progress. Existing storage helpers also throw if accessing the sessionStorage property itself raises SecurityError; ordinary storage method failures are caught. No storage production fix was made.

C2.2–C2.6 have not begun. Final readiness must not be inferred from baseline checks.

## Confirmed safety blocker after independent review follow-up

Status superseding the earlier green characterization gate: C2.1 is blocked; C2.2–C2.6 have not begun. No production source changes were made.

Controller reran the five-file focused suite on unchanged production source: **118 passed, 4 failed, 0 skipped** (`E:/EasyToeicC2/artifacts/c21-confirmed-focused.json`). The four new failures are separate from the six historical full-suite failures. They reproduce one pre-existing async session-context bug:

1. Start a deferred rating in the current session.
2. Change topic/status while retaining the same current vocabulary ID.
3. Resolve the old rating successfully.
4. The old continuation writes the original queue/context snapshot and clears pending recovery; a previous final-card action can complete the replacement session.

Root cause: `handleRating` captures queue/index/filter before awaiting persistence. Its continuation checks mount and current vocabulary ID, but has no session-context generation guard. Matching the same ID does not establish that the original session is still active. Failure-response and changed-ID cases pass. Two real synchronous rating clicks and stale recognition callbacks against a replacement recognizer now pass strengthened tests.

Observed impact is local session/snapshot correctness and recovery loss, not demonstrated database corruption or cross-account leakage. RPC authorization, SRS server scheduling, services and AppPage remain unchanged.

### Proposed focused correction, awaiting separate approval

Before any extraction, add a monotonic session/context generation token in the existing container. Capture it with the action before persistence. Invalidate it whenever the session is replaced/reset (including a return to the same topic/status). After persistence confirms success, retain user-scoped confirmed pending metadata but reject local queue/stat/completion/snapshot mutation if the captured generation is stale. Preserve existing unmount/logout protection so cleared recovery is not recreated after account changes. Keep the synchronous duplicate lock, RPC payload, idempotency key, retry behavior, server result and snapshot v1 format unchanged.

Required proof: the four current failures pass; same/different-ID context changes, context A-to-B-to-A, final-card, retry/recovery, unmount/logout and rapid-action tests pass; one logical rating still yields one RPC and zero Auth preflight requests; independent review approves. Then resume the approved C2 sequence. Storage getter hardening is a separately documented defect and is not included in this proposed correction.

Approval boundary comes from the approved plan C2.1: "If a test reveals a confirmed bug, stop that extraction and handle it under systematic-debugging/TDD in a separately approved bug-fix task." This blocker is preserved with ordinary failing tests, without skipping or weakening assertions.

### Current scope and safety verification

Tracked diff: `components/FlashcardMode.test.tsx` only. New code files: `lib/session/queueTransition.test.ts`, `lib/session/storage.test.ts` only. Planning/design copies and this execution report are new untracked documents; untracked AGENTS.md was copied for implementation instructions. No application source, dependencies, Supabase files or C1 loading code changed. `git diff --check` passed; protected-source diff against HEAD is empty. Local main, origin/main tracking ref and feature HEAD remain `ca8c096413a6292324ea1c09bf2664f38d76467d`. No network push, deployment or Production data access occurred. All new artifacts remain on E:, with existing browser binaries on D:.

Independent re-review confirmed the four failing fixtures are valid and expose one pre-existing session-context-generation bug. Double-click and stale-recognition review findings are resolved. Evidence: `E:/EasyToeicC2/artifacts/c21-rereview.md`. Reviewer requested preserving the four tests red pending the narrow-fix safety checkpoint; no source edits or reviewer reruns occurred.

## Narrow bug-fix authorization and initial implementation

User explicitly approved the context-generation correction and resuming C2.2–C2.6 after green focused verification and independent review. This supersedes the earlier awaiting-approval status only for that narrow correction. Storage getter hardening remains outside scope.

Container now has a monotonic generation increment on external topic/status reset, explicit restart and empty-filter fallback. A rating captures the generation before awaiting persistence. Confirmed success retains pending metadata and rejects queue/stat/snapshot/completion mutations if generation or current card differs. Existing keyed account mount/unmount guards and RPC boundary are retained.

Initial focused run: 122/122 passed, including the four previously failing reproductions (`context-fix-focused.json`). Additional A-to-B-to-A and recovery/retry tests plus independent review are in progress; this is not yet a closed gate.

## Narrow fix gate closed; C2.2 complete

The expanded bug-fix gate passed 128/128 focused tests. Independent reviewer approved with no findings and independently repeated focused tests, source/test lint and typecheck. Same/different-ID context changes, final-card replacement, topic/status ABA, same-key recovery, rapid calls, account/unmount guards remain covered. Expanded full-suite evidence: 558 passed, the same six failures, one intentional bundle skip. Source fix checkpoint preserved outside Git at E:/EasyToeicC2/artifacts/c21-approved-FlashcardMode.tsx; no commit.

C2.2 added activeVocabulary, restoreStudySession and flashcardOptions pure modules with 16 tests; controller and independent reviewer each passed 100 tests including the component characterization suite. Review approved no findings. Selection imports due logic directly from the pure module. Fixed time, ordering, duplicate restore IDs, snapshot v1 and literal quiz seed output are preserved. Typecheck and lint pass with existing warnings. Checkpoint: E:/EasyToeicC2/artifacts/c22-FlashcardMode.tsx.

C2.3 single-owner session extraction is in progress. All newly dispatched agents use gpt-6-sol as requested.

## C2.3 session ownership gate

Added useFlashcardSession and eight hook tests. Prepared actions capture user, generation, queue identity, current index/card and rendered safeIndex before persistence, reject stale or duplicate commits, and apply the same transition to state and the v1 snapshot. Container retains rating RPC/pending state until C2.4 and all audio/recognition/animation/confetti. Independent review passed; final hook+component run 92 passed; broader controller run before the eighth hook test was 107 passed. Typecheck and focused lint passed.

Reviewer documented an existing external-deletion edge: a removed queued ID can leave raw queue longer than the visible list; safeIndex clamping and original queue transition can repeat a visible card. C2 preserves this behavior rather than introducing an unapproved queue correction. This is separate from the fixed asynchronous context defect and is follow-up work.

C2.4 rating lifecycle extraction is in progress.

## C2.4 rating lifecycle gate

Added useFlashcardRating and 18 hook tests. It owns synchronous submission lock, in-memory pending action, retry/error state, user-scoped recovery serialization and the parent mutation callback. Session actions remain prepared before the await and accept local queue commits only after confirmed persistence. Container retains sound, flip/reveal reset, animation, recognition and confetti.

Review caught an intermediate extraction error: persisted storage existence was incorrectly required for a confirmed local commit. That condition was removed. A deferred getItem failure test now proves a valid confirmed action still commits; logout/account generation tests prove invalidated continuations cannot recreate cleared metadata or release a replacement request lock. Same-user stale-card recovery/error indication is preserved.

The hook retains an already known confirmed status while explicitly retrying its original key; this narrowly satisfies the approved confirmed-recovery invariant until local commit acceptance. RPC payload/key/call count and snapshot schema are unchanged. This distinction was independently reviewed and documented rather than silently represented as an identical pre-RPC status write.

Final independent and controller rating/session/component/page/service focused runs each passed 125/125. Implementer broader run: 147 passed, one bundle-only skip. Typecheck and focused lint passed. Independent final C2.4 verdict approved with no unresolved blocking issue. Checkpoints c24-FlashcardMode.tsx and c24-useFlashcardRating.ts are on E:. No service, storage implementation, AppPage or database changes.

C2.5 controlled view extraction is in progress.

## C2.5 and C2.6 continuation, 2026-11-17

Four controlled views (`FlashcardExercise`, `QuizExercise`, `TypingExercise`, `PronunciationExercise`) and their focused tests were extracted. The Flashcard container retains audio, speech-recognition, animation, keyboard and rating orchestration. Independent C2.5 review found no blocking issue; it reran 88 view/container tests, lint and typecheck. No view extraction was reverted.

Integrated independent review found a new recovery bug: after a successful local commit, a failed browser-storage `removeItem` could leave a confirmed record that blocked rating the next card. A regression test failed on the original hook, then passed after a per-user in-memory cleared-key guard. Re-review found the one-key guard insufficient when storage remained read-only across multiple ratings; a second regression test failed on that version, then passed after retaining cleared keys per user for the mounted hook lifetime. Independent final re-review approved the correction; 114 rating/session/container focused tests passed. Genuine unresolved actions still retain their original retry key. The mounted-hook key set grows with successful ratings; this is a follow-up efficiency risk. A full remount while storage removal persistently fails loses that in-memory guard, a pre-extraction storage limitation.

Final checks on the corrected source: 608 passed, the same six established failures, and one expected build-dependent skip in `npm test -- --maxWorkers=1`. The failures remain five batching/dedup assumptions in `progressService.test.ts` and one C1 concurrent-loading conflict in `appDataService.test.ts`; no assertion was changed. Full lint exited 0 with three pre-existing `img` warnings. `npx tsc --noEmit --incremental false` exited 0. Production build with local-only placeholder Supabase values exited 0; post-build bundle test passed. `/app` initial manifest: baseline 11 chunks / 880,621 raw / 250,175 gzip bytes; final 11 chunks / 880,700 raw / 250,162 gzip bytes. SheetJS absent from initial chunks. The build does not use live credentials.

Local deterministic browser fixture: all four modes captured at desktop 1440x900 and mobile 390x844. Product HTML before Next development scripts was identical for all eight baseline/final captures. Six screenshot pairs were pixel-identical; quiz and pronunciation desktop differed by 123 and 110 pixels around small icons (under 0.01% of the screen), with no observed layout/content change. Keyboard browser smoke passed native Tab/Shift+Tab, focused navigation Enter, Space reveal, quiz digit selection, Typing Enter/repeat and pronunciation skip. Microphone hardware was not tested.

Browser profiling used headless Chromium, Next development mode, in-memory 100/1,000/5,000 word fixtures and zero-delay rating callback; each group had one warmup and five measured samples. Historical C2.1 baseline initialization/rating medians (ms): 100 1092.7/76.1, 1,000 962.6/83.3, 5,000 782.4/90.5. Final medians: 100 2151.5/137.1, 1,000 2238.7/166.2, 5,000 1841.6/121.3. A contemporaneous baseline control run: 100 1548.1/95.4, 1,000 1591.5/108.4, 5,000 2361.8/155.2. All groups had three rating React commits per sample. Large run-to-run variance and opposite direction at 5,000 prevent a performance-gain or regression conclusion. No persisted 5,000-row Supabase study was performed.

Authenticated final Supabase Local smoke could not run: the existing local API at 127.0.0.1:55421 refused connections and the Docker Desktop Linux daemon pipe was unavailable. The existing stack was neither reset nor recreated. Earlier C2.1 authenticated baseline smoke passed four modes, 0 rating-time Auth requests, 1 rating RPC, review log/progress increment, session reload/logout/account isolation; this is baseline evidence only, not verification of the final C2 source. Final local SRS/RPC behavior therefore remains a release-readiness check.

Temporary profiling routes and baseline component were moved to E:/EasyToeicC2/ outside the worktree. Generated `tsconfig.tsbuildinfo` was archived on E: and its tracked baseline restored. Local `main`, remote `main` and feature HEAD all remain ca8c096413a6292324ea1c09bf2664f38d76467d. No commits, pushes, merges, deployments or Production data access occurred. All new worktree/artifacts/dependencies/caches were on E: (existing browser binaries on D:). Phase C2 implementation remains uncommitted pending separate authorization; authenticated final smoke is incomplete.

## Authenticated smoke completion after Docker restart, 2026-11-17

The user restarted Docker. The existing isolated `easytoeic-phase1-local-verify` containers resumed; Auth health returned HTTP 200 on `127.0.0.1:55421`. No reset, stack recreation, signup or schema action occurred. The final C2 application ran at `localhost:3194`, with a local-only Supabase URL and an in-memory local anon key derived from that existing local stack. Browser profiles, logs and screenshots remained on D:/E:. Both existing authorized local accounts were reused.

The first two browser attempts were stopped by the existing review reminder overlay, which appeared asynchronously after the dashboard loaded. The external E: smoke harness was corrected to dismiss the visible reminder before navigation; no application source changed. The bounded final attempt passed and produced `E:/EasyToeicC2/artifacts/after-auth-smoke.json` and `after-retry-smoke.json`.

Verified on the final C2 source: Flashcard, Quiz, Typing Enter, Pronunciation UI and skip; one ordinary rating RPC, zero rating-time `/auth/v1/user` calls, one review log and one review-count increment; saved session restored after reload; logout redirected; the second local account's vocabulary IDs were disjoint; no browser page errors or external Supabase requests. Actual microphone recognition remains untested.

The controlled response-loss test allowed the local server to commit the first rating, then aborted the browser response. The queue did not advance before confirmation. Explicit retry used the identical idempotency key and payload; the server returned `already_processed`. Two RPC attempts produced exactly one review log, zero rating-time Auth requests and a subsequent queue advance. Only isolated local test data changed.

The delayed-aggregate local browser check measured core-data request completion at 1,207 ms, learning navigation ready at 1,481 ms, aggregate response at 4,111 ms and aggregate UI ready at 4,358 ms. With a controlled local 503 aggregate response, core completion was 1,727 ms and learning navigation ready at 2,061 ms; Flashcard navigation remained usable. The dashboard displayed loading placeholders rather than incorrect zeros while aggregate values were unknown. These timings are single development-browser runs, not Production latency estimates. Initial app navigation made two Auth requests; that count is separate from the zero rating-time Auth count. No external Supabase requests or page errors were observed.

This supersedes the preceding statement that final authenticated smoke was incomplete. The only untested browser hardware path is real microphone recognition. Local/remote main remain untouched; no commit, push, merge or deployment was performed.

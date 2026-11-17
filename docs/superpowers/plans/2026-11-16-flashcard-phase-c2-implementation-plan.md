# EasyTOEIC Flashcard Phase C2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` after the user approves this design. Each task ends with focused tests and review.

**Goal:** Incrementally separate Flashcard pure rules, session orchestration, rating recovery and mode rendering without changing UI, learning behavior, SRS or persistence.

**Architecture:** Follow the reviewed design in `2026-11-16-flashcard-phase-c2-design.md`. Keep AppPage and the server-authoritative RPC boundary stable. Add pure characterization-backed utilities first, then extract one owner for session state and one owner for rating lifecycle, and finally move controlled mode views one at a time.

**Tech Stack:** Existing Next.js 15 / React 19 / strict TypeScript / Vitest+jsdom / existing Playwright harness. No new dependencies.

**Spec:** `docs/superpowers/plans/2026-11-16-flashcard-phase-c2-design.md`, `docs/SRS_TARGET_SPEC.md`, `docs/DATA_OWNERSHIP_CONTRACT.md`, `docs/UI_PRESERVATION_CONTRACT.md`, and the Phase A/B/C1 plans in this directory.

## Global constraints

- Baseline is `ca8c096413a6292324ea1c09bf2664f38d76467d`; implementation must use a new E: worktree rooted at this SHA after separate approval.
- Use D:/E: exclusively for all new worktrees, installs, build output, temporary files, browser profiles, screenshots, logs and caches. Check disk space first. Set `TEMP`, `TMP`, npm cache and browser profile paths to E:.
- Preserve existing untracked `AGENTS.md`, `docs/plans/`, all existing worktrees/accounts/data and the deferred Phase 1 branch.
- No Production/Preview Supabase data mutation, DB/schema/RLS/RPC/migration change, dependency install, UI redesign, Phase 1, C1 page/service change, push, merge or deployment.
- Do not alter rating values, scheduling, the RPC request/response contract, retry key semantics, session snapshot format, Auth request count, or current UI interactions.
- No performance claim from modularity or synthetic CPU alone. Compare browser and bundle results with the same captured baseline harness and report noise/limitations.
- Existing full-suite gate is 486 pass, six documented baseline failures, one build-dependent test skipped by default. No additional test failure is acceptable. Preserve the `appDataService` assertion and explain its contract conflict.
- Do not commit without separate authorization. Each task should remain independently revertible in the feature worktree; rollback must preserve uncommitted user data.

## File map (planned)

| File | Planned role |
|---|---|
| `components/FlashcardMode.tsx` | Shrink into the composition container; keep shared shortcut policy, dialog shell, audio/animation refs and callback wiring. |
| `components/FlashcardMode.test.tsx` | Keep end-to-end component characterization for keyboard, rating and interactions; add only durable component-level cases. |
| `lib/session/activeVocabulary.ts` / `.test.ts` | Pure topic/status selection and ordering from supplied data/time. |
| `lib/session/restoreStudySession.ts` / `.test.ts` | Pure validation/reconciliation of a stored snapshot with the active user/context/available IDs. |
| `lib/session/queueTransition.ts` / `.test.ts` | Existing queue transition contract, unchanged implementation unless characterization exposes a confirmed defect. |
| `lib/session/storage.ts` / `.test.ts` | Existing user-scoped session/pending-action serialization contract; no schema/version change. |
| `lib/quiz/flashcardOptions.ts` / `.test.ts` | Pure seeded embedded quiz options using existing `seededShuffle` and `uniqueQuizLabels`. |
| `hooks/useFlashcardSession.ts` / `.test.tsx` | Sole React state owner for filter, queue/index, restore, completion/session stats and successful queue/snapshot commit. |
| `hooks/useFlashcardRating.ts` / `.test.tsx` | Pending action, sync duplicate lock, same-key retry and server-confirmed callback; calls existing parent persistence callback only. |
| `components/flashcard/FlashcardExercise.tsx` / `.test.tsx` | Controlled rendering of card faces/reveal actions. |
| `components/flashcard/QuizExercise.tsx` / `.test.tsx` | Controlled embedded Quiz view; options supplied by pure helper. |
| `components/flashcard/TypingExercise.tsx` / `.test.tsx` | Controlled input/result view; local Enter interaction stays behaviorally identical. |
| `components/flashcard/PronunciationExercise.tsx` / `.test.tsx` | Controlled status/feedback view only; Recognition API stays in the container. |
| `app/app/page.tsx`, `services/vocabService.ts`, `services/progressService.ts`, `supabase/**` | Leave unchanged; they remain the data/Auth/SRS boundary. |

If a view extraction causes a broad generic prop layer, duplicates state, or changes DOM output, omit that view extraction and document why. The file map is an expected target, not permission to create empty scaffolding.

## C2.1 — Characterization tests and baseline (risk: low)

**Files:** Modify `components/FlashcardMode.test.tsx`; create `lib/session/queueTransition.test.ts` and `lib/session/storage.test.ts`; only add small missing cases to existing page/rating or service tests if the contract boundary needs characterization. No production source changes.

### Required scenarios before extraction

1. **Queue transitions:** fixed input/output table for Again reinsertion gap 5, duplicate pending ID removal, Hard/Good/Easy/Mastered advancing one index, completion, one-item queue, last-item Again, and no input mutation.
2. **Storage:** valid v1 snapshot round trip; user key isolation; invalid version/user/IDs/index; malformed JSON; unavailable/throwing sessionStorage; pending statuses pending/retrying/confirmed and same idempotency key. Do not introduce a new serialized field.
3. **Rating component lifecycle:** first success, already-processed success, failure and explicit retry with the same key, repeated/rapid action creates one pending logical action, logout/account switch/unmount during unresolved RPC, confirmed response with storage failure, queue does not advance before success.
4. **Session restoration and filters:** reload restore at stored index; context mismatch; deleted IDs; empty/malformed list; topic/status change resets; new/due/learning/mastered/all ordering with a fixed `nowMs`; completed session/restart; collection/topic selection does not restore another context.
5. **Mode behavior:** all four embedded modes; quiz options/correct answer and insufficient pool; Typing Enter once, IME composition and focus guard; Tab/Shift+Tab remain native; keyboard shortcut mode guards; Pronunciation UI state transitions with a fake recognition object and attempt cancellation, without real microphone permission.
6. **Account isolation:** `FlashcardMode` keyed remount plus existing AppPage A→B, logout, A→B→A late-result tests. Assert one rating RPC and no rating-time `/auth/v1/user` request.
7. **UI baseline:** authenticated local browser screenshots for desktop and mobile in each of four modes, using deterministic vocabulary IDs/content. Capture initial bundle and collect initialization, rating-to-next and render-commit measurements for 100, 1,000 and 5,000 in-memory vocabularies with a fixed harness.

### Steps

- [ ] Read the C2 design and current SRS/UI contracts; verify the working tree is the new E: feature worktree at the approved baseline.
- [ ] Add queue transition table tests and storage round-trip/error tests against current helpers.
- [ ] Run `npx vitest run lib/session/queueTransition.test.ts lib/session/storage.test.ts`; record any pre-existing behavioral mismatch before touching source.
- [ ] Add missing component lifecycle cases to `components/FlashcardMode.test.tsx`; do not duplicate assertions already covered by current tests.
- [ ] Run `npx vitest run components/FlashcardMode.test.tsx app/app/page.rating.test.tsx services/vocabService.rating.test.ts` and confirm characterization passes on unchanged implementation. Do not include all of `services/progressService.test.ts` in this focused gate: its five known batching assertions already fail at the C1 baseline. If a rating-service-specific assertion is needed, add it to `services/vocabService.rating.test.ts`, which verifies one authorized RPC and zero `getUser` calls.
- [ ] Capture local browser screenshots, bundle values and repeated browser measurements. Use only isolated Supabase Local and approved local accounts; do not reset or delete data.
- [ ] Review the baseline additions and close C2.1 only when all assertions pass against unchanged application source.

**Acceptance:** Characterization tests pass before refactor; artifact table records browser/build versions, fixture distribution, sample counts and limitations. Baseline source remains unmodified. If a test reveals a confirmed bug, stop that extraction and handle it under systematic-debugging/TDD in a separately approved bug-fix task.

## C2.2 — Extract deterministic helpers (risk: low to moderate)

**Files:** Create `lib/session/activeVocabulary.ts`, `lib/session/activeVocabulary.test.ts`, `lib/session/restoreStudySession.ts`, `lib/session/restoreStudySession.test.ts`, `lib/quiz/flashcardOptions.ts`, `lib/quiz/flashcardOptions.test.ts`; modify `components/FlashcardMode.tsx` only to call these helpers. Do not edit existing scheduler, RPC, or page code.

### Contracts

```ts
export function selectActiveVocabulary(input: {
  vocabularies: readonly Vocabulary[];
  topicId: string;
  status: FlashcardInitialFilter;
  nowMs: number;
}): Vocabulary[];

export function reconcileStudySession(input: {
  snapshot: StudySessionSnapshot | null;
  userId: string | null;
  topicId: string;
  status: FlashcardInitialFilter;
  availableVocabularyIds: ReadonlySet<string>;
}): { vocabularyIds: string[]; currentIndex: number } | null;

export function createFlashcardQuizOptions(
  current: Vocabulary | undefined,
  activeVocabulary: readonly Vocabulary[],
): { options: string[]; correctAnswerIndex: number };
```

The selection helper must preserve current order for each status, the due predicate, fixed mount timestamp semantics, and sort tie behavior. It must not mutate `vocabularies`. Reconciliation preserves snapshot v1 rules and existing fallback to a fresh active queue. Quiz option generation preserves the existing seed strings (`${current.id}_distractors`, `${current.id}_choices`), normalized deduplication order and maximum of four options. An empty/invalid correct meaning yields no options exactly as current code does.

### Steps

- [ ] Move current selection branches into a test-local reference function and add table tests for all status/topic/time cases.
- [ ] Add RED assertions for the new exported function contract; run `npx vitest run lib/session/activeVocabulary.test.ts` and observe missing-module failures.
- [ ] Implement the pure helper with explicit `nowMs`; replace only the equivalent `topicVocabs`/`activeVocabs` calculation in the component.
- [ ] Add snapshot reconciliation tests for wrong user, topic/status mismatch, missing IDs, empty valid IDs and bounded index; extract the existing branch into the helper without changing storage access location.
- [ ] Add quiz generation RED tests for deterministic IDs, correct label once, duplicate/case/whitespace meanings, 1–3 valid unique choices, blank meaning and empty pool.
- [ ] Implement helper using existing `uniqueQuizLabels` and `seededShuffle`; replace the existing `useMemo` body without changing seeds.
- [ ] Run `npx vitest run lib/session/activeVocabulary.test.ts lib/session/restoreStudySession.test.ts lib/quiz/flashcardOptions.test.ts components/FlashcardMode.test.tsx`.
- [ ] Compare serialized outputs against the characterization fixtures and run independent review before C2.3.

**Acceptance:** Pure helpers have no React, `window`, Supabase, storage or random-global dependency. Existing component tests pass. No caller observes a changed order, answer label, correct index, queue or snapshot.

## C2.3 — Extract single-owner session orchestration (risk: moderate to high)

**Files:** Create `hooks/useFlashcardSession.ts` and `hooks/useFlashcardSession.test.tsx`; modify `components/FlashcardMode.tsx`; reuse C2.2 helpers and `lib/session/queueTransition.ts` / `lib/session/storage.ts`.

**Ownership contract:** Hook owns exactly one copy of `filterTopic`, `filterStatus`, `studyQueue`, `currentIndex`, `isSessionRestored`, `isCompleted`, and `sessionStats`. It does not own UI settings, typing/quiz answer inputs, speech recognition, network mutation or pending rating lock. The hook must key/reset by `userId` and receive props for available vocabularies and initial external filters.

**Proposed API:**

```ts
interface UseFlashcardSessionOptions {
  userId: string | null;
  vocabularies: Vocabulary[];
  selectedTopicId: string;
  initialStatus?: FlashcardInitialFilter;
  onCompleted?: () => void;
}
interface FlashcardSessionController {
  filterTopic: string;
  filterStatus: FlashcardInitialFilter;
  activeVocabulary: Vocabulary[];
  currentIndex: number;
  currentVocabulary: Vocabulary | undefined;
  subMode: StudySubMode;
  isCompleted: boolean;
  sessionStats: SessionStats;
  selectTopic(topicId: string): void;
  selectStatus(status: FlashcardInitialFilter): void;
  advanceMode(): void;
  commitSuccessfulRating(input: { vocabularyId: string; rating: SrsRating; isMastered: boolean }): boolean;
  restart(): void;
}
```

`commitSuccessfulRating` is called only after `onUpdateProgress` resolves. It must reject stale user/session/current-card actions, use `applyRatingToQueue`, commit queue and index atomically from one captured session state, update stats exactly once, save the v1 snapshot only for a non-complete session, and clear the user-scoped snapshot on completion. The hook does not issue a rating request and does not predict SRS fields. The final signature can be simplified during implementation only if ownership remains as stated and characterization tests demonstrate the same timing/guards.

### Steps

- [ ] Create hook tests for initial loading/restore, prop topic/status changes, manual filter changes, restart, empty data, and completion before moving state.
- [ ] Add a RED test for stale `commitSuccessfulRating` after user switch, context reset, card change and unmount cleanup.
- [ ] Implement hook initialization from `loadStudySession` and C2.2 `reconcileStudySession`; preserve no-user behavior and bounded snapshot recovery.
- [ ] Move filter/queue/index/restore/completion/stat state and associated reset effects from `FlashcardSession` to the hook. Keep answer and settings state in the component.
- [ ] Replace inline queue transition in `handleRating` with a prepared session action captured before the await and committed only after successful parent callback. Keep the synchronous rating lock until C2.4 extraction.
- [ ] Verify again that session storage is written after server success only; add rejection tests proving failed RPC leaves queue/index unchanged.
- [ ] Run `npx vitest run hooks/useFlashcardSession.test.tsx components/FlashcardMode.test.tsx app/app/page.rating.test.tsx lib/session/activeVocabulary.test.ts lib/session/restoreStudySession.test.ts`.
- [ ] Inspect React effect cleanup/StrictMode behavior and request independent review before proceeding.

**Acceptance:** one owner per listed session field; session v1 format and lifecycle unchanged; stale work cannot affect another account; AppPage and its generation guards are unchanged; all four modes still receive the same current item and progression.

## C2.4 — Extract rating lifecycle (risk: high)

**Files:** Create `hooks/useFlashcardRating.ts`, `hooks/useFlashcardRating.test.tsx`; modify `components/FlashcardMode.tsx` and, only if TypeScript requires, its prop interface. Do not change `app/app/page.tsx`, service/RPC code or session storage format.

**Ownership contract:** Hook owns only synchronous in-flight lock, pending action ref/state, retry visibility and submit/error lifecycle. It receives `userId`, current vocabulary ID, `onUpdateProgress`, and an `onCommitted` callback that carries the confirmed vocabulary ID/rating/mastered flag to `useFlashcardSession.commitSuccessfulRating`. It reuses the existing `PendingRatingAction` shape and storage helpers.

**Required transition table:**

| Event | Pending key | Queue | Retry UI |
|---|---|---|---|
| New action | Create one UUID; save retrying before await | unchanged | submitting |
| Valid RPC success or already processed | Keep confirmed key until local session commit completes | commit once | clear after local commit |
| Transport/ordinary failure | Preserve original key and action | unchanged | explicit retry |
| Retry | Reuse original key and payload | unchanged until confirmed | submitting |
| Permanent idempotency contract error | Clear unusable pending key | unchanged | offer a new explicit action |
| User change/unmount/current card change | Do not write old state into new session | unchanged for new account | old action remains user-scoped recovery as currently specified |

### Steps

- [ ] Write hook tests for each table row and assert exact callback/RPC invocation counts through the passed callback.
- [ ] Add rapid double-action test proving the synchronous ref lock permits one logical in-flight request before React rerender.
- [ ] Add deferred-promise tests for logout, account switch, unmount, current card change, storage throwing, same-key retry and `already_processed`.
- [ ] Run the new tests against the extracted hook API and confirm expected RED failures before implementation.
- [ ] Move pending-action loading, UUID creation, save/clear, retry and submission lock from `FlashcardSession` to the hook. Keep `onUpdateProgress` as the only persistence callback; do not instantiate a Supabase client in the hook.
- [ ] On success, wait for `commitSuccessfulRating` to accept the current action before clearing recovery state. If it rejects a stale action, keep safe recovery metadata in the old user scope and do not mutate the replacement session.
- [ ] Run `npx vitest run hooks/useFlashcardRating.test.tsx hooks/useFlashcardSession.test.tsx components/FlashcardMode.test.tsx app/app/page.rating.test.tsx services/vocabService.rating.test.ts`.
- [ ] Review the hook and compare RPC/GET request counts against Phase B; stop and revise if a second RPC, `auth.getUser()`, changed idempotency key, early queue transition or duplicate state owner appears.

**Acceptance:** exactly one RPC per successful logical action; zero Auth user preflight requests during rating; retries reuse the same key; failure never advances queue; success applies server result once; review log/progress behavior remains delegated to the existing atomic RPC.

## C2.5 — Extract controlled mode views one at a time (risk: moderate)

**Files:** Create `components/flashcard/FlashcardExercise.tsx`, `QuizExercise.tsx`, `TypingExercise.tsx`, `PronunciationExercise.tsx` and focused view tests; modify `components/FlashcardMode.tsx` to compose them. Keep all existing DOM hierarchy, semantic roles, accessible names, Tailwind classes, animation hooks and responsive classes unchanged.

Each view receives the current vocabulary/value state and explicit callback props. It may not import Supabase, session storage, queue transitions, browser speech recognition constructors, or app data services. Pronunciation API construction, event attempt guards and stop/abort cleanup remain in the container. Global keyboard listeners remain in the container and call the same action callbacks. Shared rating/retry UI, header, settings/report/edit modals and completion screen remain in the container unless review finds a narrow view-only seam.

### Steps

- [ ] Extract the embedded Quiz markup only; add an integration test that selects options by mouse and digit shortcut, checks correct feedback and confirms no progress is persisted before rating. Compare rendered DOM/classes to baseline.
- [ ] Extract Typing markup; verify input focus, Enter once, repeated/composing Enter, feedback and rating reveal. Keep the global shortcut guard unchanged.
- [ ] Extract Pronunciation presentation; verify idle/listening/correct/incorrect/unsupported/permission-denied/no-speech/error and retry/skip actions with a fake recognizer at the container boundary. Do not request real microphone permission in automated CI.
- [ ] Extract Flashcard face/reveal markup last; verify Space, click-to-flip, reveal buttons, audio trigger and rating reveal against the same container state.
- [ ] Run `npx vitest run components/flashcard components/FlashcardMode.test.tsx` after each view extraction (or the exact individual test paths if Vitest does not accept a directory).
- [ ] If a view requires broad prop plumbing or duplicates state, revert only that view extraction and document the evidence; do not add a generic mode plugin system.

**Acceptance:** four controlled views render the same visible text, controls, focus order, classes and callbacks. `FlashcardSession` contains shared shell/wiring, not mode-specific JSX blocks. No global keyboard, audio, animation, modal or microphone lifecycle behavior changes.

## C2.6 — Integrated verification and review (risk: moderate)

**Files:** Update this plan’s execution evidence only; application changes limited to files above.

### Required gates

- [ ] Focused tests for pure helpers, session hook, rating hook, all mode views, AppPage rating integration, progress RPC contract and session storage.
- [ ] Full `npm test -- --maxWorkers=1`; compare exact failing test identities against the six C1 baseline failures, preserving every assertion. The built bundle check may skip in this run only if it is then run explicitly after successful build.
- [ ] `npm run lint` and `npx tsc --noEmit --incremental false`.
- [ ] `npm run build` with local-only public Supabase placeholders; save output on E:. Then run `PHASE_B_BUNDLE_CHECK=1 npx vitest run app/app/page.bundle.test.ts` and report initial `/app` raw/gzip manifest values and SheetJS exclusion.
- [ ] Repeat the same browser harness and vocabulary distributions at 100, 1,000 and 5,000 items; report initialization, rating-to-next and render commits as browser/dev measurements, not Production latency. Compare before/after with the same sampling procedure; make no improvement claim if noise overlaps.
- [ ] Run authenticated browser smoke only against isolated Supabase Local: all modes, rating/retry and review log, session restore, logout/account switch, collection/topic filters, Enter/Tab keyboard behavior. Keep existing local data; no Production/Preview credentials.
- [ ] Capture desktop/mobile screenshots at the same viewport and deterministic fixture IDs; compare all four modes and inspect any pixel diff. A difference requires explanation and must not alter visuals.
- [ ] Request independent review of each meaningful extraction and final branch; resolve confirmed in-scope findings and re-run affected checks.
- [ ] Run `git diff --check`; verify only planned files, no Phase 1/database/dependency changes, main untouched, and all artifacts on D:/E:.

**Acceptance:** no new full-suite failures, all release contracts above hold, no visual regression, no new Auth request or duplicate RPC, build/bundle test pass, review has no unresolved important findings. If a gate cannot be run safely, report it as incomplete and do not claim phase completion.

## Risk and rollback matrix

| Task | Risk | Main failure mode | Rollback |
|---|---|---|---|
| C2.1 characterization | Low | Tests assume behavior not present | Correct the test to match verified contract before any source edit; do not weaken an existing assertion silently. |
| C2.2 pure helpers | Low–moderate | Ordering, seed, due-time or empty-input drift | Revert only helper/call-site commit or restore the exact pre-task component block; keep characterization tests. |
| C2.3 session hook | Moderate–high | Snapshot timing, duplicate session state, stale callback or filter reset changes | Revert hook extraction as one unit; keep C2.2 pure helpers. Do not retain a partly duplicated owner. |
| C2.4 rating hook | High | Lost/duplicated RPC, key rotation, queue commit before server, account leak | Stop immediately; revert hook and wiring as a unit. Preserve the existing rating component path until all retry and account tests pass. |
| C2.5 view extraction | Moderate | DOM/focus/layout/keyboard change or broad props | Revert the individual view extraction and keep remaining views/container. No visual changes are accepted implicitly. |
| C2.6 integrated gates | Moderate | New test failure, bundle/Auth regression or screenshot diff | Do not merge/deploy. Revert only the offending task in the feature worktree and rerun its focused gate. |

Rollback applies in the isolated feature worktree. Do not reset/delete a branch or remove a worktree containing user data. Do not push or deploy during C2. A later local commit requires separate authorization.

## Explicit non-goals

No SRS or database work; no Auth/RLS changes; no feature additions; no standalone QuizMode cleanup; no accessibility behavior changes; no microphone lifecycle changes; no dashboard/AppPage refactor; no broad reducer/state-library rewrite; no speculative performance optimization; no Phase 1/C1 edits; no production release.

## Self-review checklist

- [x] Every in-scope behavior maps to a characterization/extraction/verification task.
- [x] SRS/RPC, Phase B identity optimization, C1 loading and collection-stat contracts are explicit preservation invariants.
- [x] Plan identifies exact files, APIs, tests, commands, dependencies, risks and rollback per task.
- [x] Browser/UI performance measurements are not represented as guaranteed gains.
- [x] Known six baseline failures and the aggregate-contract discrepancy remain explicit.
- [x] Plan authorizes investigation and design only; implementation still requires explicit user approval.

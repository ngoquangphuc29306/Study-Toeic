# Flashcard Phase C1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make learning data available independently of aggregates and remove measured collection aggregation waste without changing learning behavior.

**Architecture:** Keep AppPage as data owner. Load core and derived snapshots concurrently, committing independently with user, generation, local-revision and unmount guards. Count vocabulary by topic once and preserve the original per-collection topic-set semantics.

**Tech Stack:** Next.js 15 / React 19, TypeScript, Vitest/jsdom, existing Playwright installation, isolated Supabase Local.

**Spec:** User-approved Phase C1 design (2026-11-16), `docs/SRS_TARGET_SPEC.md`, `docs/DATA_OWNERSHIP_CONTRACT.md`, `docs/UI_PRESERVATION_CONTRACT.md`.

## Global Constraints

- Baseline `5f9a279dbe33d7276b75a627e0ec0ba46154844c`; worktree `E:/worktrees/flashcard-phase-c1`; never modify main.
- TEMP/TMP, caches, dependencies, profiles, builds and evidence on D:/E: exclusively.
- No production access, database changes, Phase 1, C2, dependency upgrades, redesign, push, merge or deploy.
- Preserve authoritative RPC scheduling, idempotency, pending retries, session restoration and all modes.
- CPU timings are not browser responsiveness. No latency claim without browser evidence.
- Six baseline test failures are comparison data, not permission to ignore new failures.
- Preserve unrelated and untracked files and existing local test data. Local commit only after successful verification and review.

## Task 1: Baseline and browser profiling

**Files:** Evidence under `E:/EasyToeicC1/artifacts/`; this plan and execution report.

- [x] Establish exact-lockfile dependencies on E:, run baseline full suite and save six failure identities.
- [x] Reuse local stack `127.0.0.1:55421`, verify endpoint isolation, reuse authorized test credentials without printing them.
- [x] Capture desktop/mobile screenshots before source changes. Profile browser initialization, rating-to-next-card, render commits for 100/1,000/5,000 deterministic vocabulary items; distinguish controlled browser fixtures from authenticated persisted local smoke.
- [x] Measure core/aggregate readiness with delayed aggregate responses; profile collection-heavy and small-collection distributions with warmup, medians and p95.
- [x] Leave FlashcardMode unchanged unless browser results identify a meaningful hot path; document negative findings.

## Task 2: Indexed collection statistics

**Files:** Create `lib/data/collectionStats.ts`, `lib/data/collectionStats.test.ts`; modify `services/appDataService.ts` only to call the helper.

**Interface:** `composeCollectionStats(collections: Collection[], topics: Topic[], vocabularies: Vocabulary[]): Collection[]`.

- [x] RED: explicit empty/missing/duplicate topic and duplicate vocabulary fixtures plus seeded comparison against the original algorithm; import the absent helper to establish RED, then implement.
- [x] Build `Map<topicId, count>`, `Map<collectionId, Set<topicId>>`; map collections in original order; sum each distinct topic's count. Duplicate topic IDs across collections count in both, matching baseline.
- [x] GREEN: deterministic equivalence tests and service tests; compare CPU timings against captured original implementation. Do not mutate inputs.
- [x] Independent task review; resolve confirmed issues.

## Task 3: Independent core and aggregate readiness

**Files:** `services/appDataService.ts`, `services/appDataService.test.ts`, `app/app/page.tsx`, `app/app/page.rating.test.tsx`, new `app/app/page.loading.test.tsx`; minimal Dashboard/Navbar edits only if required to avoid fabricated loading values.

**Interface:** export `AppCoreData`; expose `loadAppCoreData(userId): Promise<AppCoreData>`. Preserve `loadAppDataSnapshot` compatibility for existing consumers. AppPage coordinates core and derived through separate request coordinators.

- [x] RED: deferred aggregate must not prevent usable vocabulary; aggregate errors retain core; core failure preserves successful snapshot; logout/switch/A→B→A and unmount ignore late responses; overlapping refreshes cannot overwrite newer results; rating during core fetch remains authoritative.
- [x] Start core and aggregates together. Commit core immediately with existing local-revision protection; aggregates use freshest vocabularies for reconciliation and separate latest-request guards. Preserve existing auth retry/expiry handling and bounded aggregate retries.
- [x] Loading metrics keep skeletons until first success, retain prior snapshots on refresh/failure, and never publish zero as loaded data. Preserve existing markup/design wherever possible.
- [x] GREEN: focused app/data/coordinator/auth/rating tests; independent task review and fixes.

## Task 4: Integrated verification and report

**Files:** execution report under `docs/superpowers/plans/`; evidence outside source tree.

- [x] Focused tests: `npx vitest run components/FlashcardMode.test.tsx app/app/page.rating.test.tsx app/app/page.loading.test.tsx services/appDataService.test.ts lib/data/collectionStats.test.ts lib/data/requestCoordinator.test.ts`.
- [x] Full `npm test`; compare exact failures to baseline. Run `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build` with verified local-only variables; build-dependent bundle assertion after build.
- [x] Authenticated local smoke: four modes, rating RPC/review persistence, session restoration, account isolation; delayed/failed aggregate browser checks and desktop/mobile screenshot comparison.
- [x] Rerun identical benchmarks; report CPU and browser metrics independently with sample counts and limitations.
- [x] Final independent review, fresh diff/scope/main checks, exact file list and remaining risks. Commit locally only if verification gates complete; no push/merge/deploy.

## Execution ledger

- Design approved by user; no additional routine checkpoint required.
- Native worktree tool cannot choose drive; explicit E: storage requirement takes priority, so manual Git worktree used.
- Baseline CPU probe (Node 24.15.0, 20 warmups/100 samples): 100/1,000/5,000 words and 10/100/500 collections: medians 0.073/6.178/96.454 ms. Not browser evidence; repeat under identical harness before/after.

- Completed: Task2 independent review clean; Task3 two P2 findings fixed by TDD and re-reviewed; final whole-branch review clean. See execution report for fresh tests/build/browser evidence and limitations.

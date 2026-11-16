# Flashcard Performance Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant rating Auth round-trips and SheetJS from the initial `/app` load while preserving SRS, session recovery, and Excel behavior.

**Architecture:** Reuse the page's authenticated identity for user-scoped browser recovery; keep the server RPC as the authorization and scheduling boundary. Dynamically load the Excel implementation only when importing, exporting, or downloading a template. Benchmark and profile large collections before adding other optimizations.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase, Vitest.

**Spec:** User-approved Flashcard Phase B request; `docs/SRS_TARGET_SPEC.md`, `docs/DATA_OWNERSHIP_CONTRACT.md`, `docs/superpowers/plans/2026-11-15-flashcard-correctness-phase-a.md`.

## Global Constraints

- Start from `d89777fd18406489661414578ba249a4d427ff7b` in `flashcard-performance-phase-b`; preserve `main` and deferred Phase 1.
- Do not change schema, RLS, RPC, SRS scheduling, UI design, credentials, or production data.
- Do not push, merge, or deploy. Use only local authenticated test accounts.
- Record before/after results using the same build and benchmark procedure; separate synthetic CPU timings from real network latency.

## Baseline

- Node 24.15.0, Next 15.5.29, Windows worktree `fbaf`, `npm ci --ignore-scripts --no-audit --no-fund`; build with localhost Supabase URL and dummy public anon key.
- `/app` initial manifest: 12 chunks, 1,358,931 raw / 408,562 gzip bytes. SheetJS-containing chunk: 475,668 raw / 157,687 gzip bytes.
- Synthetic median CPU timings in milliseconds, 200 loops (50 for 5,000): 100 words filter/quiz/patch `0.002/0.021/0.002`; 1,000 `0.015/0.175/0.015`; 5,000 `0.075/0.794/0.082`. The benchmark lives in ignored `node_modules/.cache/phaseb-benchmark.cjs`.
- jsdom/React Profiler preliminary mount/flip samples for 100/1,000/5,000 words: `52.24/16.89`, `19.51/6.92`, `33.46/8.48` ms; three commits on mount and one on flip for each size. Cold first-run overhead means these values are diagnostic only, not browser latency. Temporary harness: `components/FlashcardMode.perf.test.tsx` (remove before final commit).
- Source path shows two `auth.getUser()` calls on the rating critical path (Flashcard storage identity and `vocabService` preflight), plus one subsequent pending-action lookup. Local Chrome against isolated Supabase Auth/PostgREST measured three `/auth/v1/user` requests and one rating RPC per action; rating click to RPC response was 640/527/448 ms (three actions, warm dev server, 12-word local fixture). These are end-to-end samples, not an RPC-only benchmark.
- Baseline desktop/mobile screenshots for all four modes exist at exact Phase A commit in the Phase A worktree's ignored `.superpowers/flashcard-phase-a/after-*.png`; inspect them before UI checks. No planned visual change.

## Task 1: Rating identity and Auth requests

**Files:** `components/FlashcardMode.tsx`, `app/app/page.tsx`, `services/vocabService.ts`, `components/FlashcardMode.test.tsx`, focused service test.

- [x] Add tests showing redundant getUser calls, safe user-scoped pending/session storage, logout/switch during an in-flight rating, failed RPC and retry idempotency. RED: 11 component, 3 page and 4 security mapping failures.
- [x] Pass authenticated page identity to Flashcard; remove component getUser calls, and remove service preflight where RPC already enforces Auth. Guard the page's post-RPC patch against an identity change.
- [x] Run focused tests and independent review: 56 focused tests pass, reviewer found no Task 1 issues. Browser request-count/latency comparison remains in final integration verification.

## Task 2: Excel on-demand loading

**Files:** `app/app/page.tsx`, `components/ExcelImportModal.tsx`, `lib/excelUtils.ts` only if needed, focused Excel tests.

- [x] Add tests for import, template download, error behavior, CSV/XLSX parsing, and a build-manifest assertion. The modal's import-time module-load test failed RED before source changes. A full-page export mount test was removed after it repeatedly leaked React `act()` work under parallel full-suite execution; authenticated browser export covers that interaction.
- [x] Remove static Excel runtime imports; load the module at the user action boundary. The compiled import sites share the same chunk.
- [x] Run focused tests and production build. `/app` initial manifest changed from 12 chunks, 1,358,931 raw / 408,562 gzip bytes to 11 chunks, 878,823 raw / 249,793 gzip bytes, with no initial SheetJS chunk. Browser downloaded CSV, XLSX, and template and previewed CSV import. Task 2 independent review found no issues.

## Task 3: Profile large collections and final verification

**Files:** `docs/superpowers/plans/2026-11-15-flashcard-performance-phase-b.md`; add source/tests only for a measured bottleneck.

- [x] Rerun identical synthetic benchmark for 100/1,000/5,000 words. After filter/quiz/patch median ms: `0.002/0.024/0.002`, `0.014/0.169/0.016`, `0.081/0.918/0.075`. React/jsdom after mount/flip samples: `45.45/14.52`, `17.41/6.00`, `30.07/7.60` ms with the same 3 mount/1 flip commits. CPU samples show no convincing compute bottleneck or improvement. No state rewrite was made.
- [x] Run full Vitest: 399 pass, 6 baseline failures, 1 build-dependent bundle test skipped by default; explicit bundle test passed after build. Lint: 0 errors, 3 existing warnings. Typecheck and build passed. Isolated Supabase Local smoke: 10/10 four-mode interactions, 6/6 rating/session persistence, 0 Auth getUser requests and 1 RPC per measured rating versus baseline 3/1. Warm rating-to-RPC samples `778/525/576` ms versus baseline `640/527/448` ms: latency change is not established. Browser Excel/CSV/template and import preview passed. Desktop/mobile screenshots: 6/8 pairs byte-identical; quiz text differs because seeded options depend on new fixture UUID, while layout matches.
- [x] Request independent code review: Task 1, Task 2, and whole-branch reviewers reported no findings. `git diff --check` passed. The final C-drive build failed at standalone copy with `ENOSPC`; a full build of a 12/12 hash-matched source copy at `D:/EasyToeicPhaseBBuild` passed and its explicit SheetJS bundle assertion passed. The earlier full build in the original worktree also passed. Local commit is the remaining step.

## Verification notes and limits

- Full Vitest in the Phase B worktree: 399 passed, 6 failed (the same five `progressService` and one `appDataService` baseline assertions), one build-dependent bundle check skipped by default. The bundle check passes when enabled after build. Focused six-file suite: 71 passed.
- Authenticated Local Auth/PostgREST: one new local test account, 10/10 four-mode smoke steps and 6/6 SRS persistence/recovery checks. The first run against a previously used local account had only three quiz choices because its new-word session was partly consumed; a fresh 12-word local fixture produced four unique choices. No production endpoint was contacted.
- Browser Excel actions: downloaded CSV, XLSX and template; CSV import preview rendered. Tests cover CSV/XLSX parser compatibility. Test accounts and local data remain in place.
- Visual comparison: flashcard, typing, and pronunciation desktop/mobile images match the Phase A screenshots byte-for-byte. Quiz content differs because seeded choices depend on each new fixture's vocabulary UUID; inspected mobile screenshot retains the same layout and controls.
- CPU/React timings are synthetic and noisy; no meaningful rating latency win is established from three warm local samples. The verified change is three fewer Auth network requests per rating. Large-collection browser testing on 5,000 persisted rows was not performed; synthetic computation and jsdom mount/flip profiling were used.
- The first repeated C-drive build hit `ENOSPC` during standalone file copy. No unrelated files or Docker volumes were removed. Build validation was repeated on D with exact file hashes.

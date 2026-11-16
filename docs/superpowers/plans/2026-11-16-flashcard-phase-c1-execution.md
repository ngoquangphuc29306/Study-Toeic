# Flashcard Phase C1 execution report

Baseline: `5f9a279dbe33d7276b75a627e0ec0ba46154844c`.
Worktree: `E:/worktrees/flashcard-phase-c1`, branch `flashcard-phase-c1`.
Approved design and implementation plan: `2026-11-16-flashcard-phase-c1.md`.

## Storage and safety

E: had approximately 242 GB free and D: 59 GB before setup. Exact-lockfile
`npm ci --ignore-scripts --no-audit --no-fund` completed on E:. TEMP/TMP and npm
cache are `E:/EasyToeicC1/temp` and `E:/EasyToeicC1/cache/npm`; browser artifacts
and reports are `E:/EasyToeicC1/artifacts`. Existing Playwright binaries on C:
are read only; launched browsers use E: temp and existing D: browser binaries.
Existing worktrees, local accounts and test rows are preserved. Main is untouched.

## Baseline evidence

- Full baseline run (with Task2 tests included): 457 passed, six known assertion
  failures plus one Synonym 5-second timeout, one bundle test skipped. This run
  overlapped Next compilation and is not accepted as the final regression gate.
- Isolated rerun of the entire SynonymPracticeHome file: 50/50 passed with the
  default timeout, confirming that the extra failure did not persist when idle.
- Local browser with a controlled 3-second delay on review-log aggregate reads:
  last core response 1,976 ms, last aggregate response 4,788 ms, navigation usable
  at 5,165 ms. One warm local sample; these are browser/network timings, not CPU.
- Browser context authenticated using an existing authorized local account via
  real Auth. Local origin `127.0.0.1:55421`; external Supabase requests blocked
  by the harness, with zero attempted. No browser page errors in baseline run.
- Dashboard desktop/mobile screenshots captured and mobile screenshot reviewed.

## Flashcard browser profiling

Real Flashcard component in Chromium headless/Next development with deterministic
in-memory vocabulary. Mock rating returns immediately and updates the fixture.
One warmup and five measured new-context runs per size, no network/save latency
claim. Profiler counts are subtree commits, not independent render counts of each
child. Initialization includes navigation and browser automation overhead.

| Vocabulary | Initialization median ms | Mount render total median ms | Rating-to-next median ms | Rating render total median ms |
|---:|---:|---:|---:|---:|
| 100 | 1350.30 | 53.30 | 121.30 | 35.80 |
| 1000 | 1203.97 | 42.50 | 85.80 | 32.70 |
| 5000 | 1728.83 | 96.10 | 110.40 | 57.80 |

Rating subtree commits: three per action in all samples. Mount commits: two or
three. Development Strict Mode, JIT, animation and shared host load limit these
numbers. No isolated expensive selector or meaningful rating bottleneck has
been established; FlashcardMode is intentionally unchanged. A bigger 5,000-word
mount alone does not justify a speculative memoization rewrite.

Raw measurements: `E:/EasyToeicC1/artifacts/baseline-browser-profile.json`.
Temporary profiling route is measurement-only and must be removed before build
and final source review.

## Collection statistics

Task2 RED: missing-helper import failed before implementation. GREEN: 59 helper
tests including 48 seeded comparisons against captured baseline logic. Inputs
are frozen in mutation tests. Independent Task2 reviewer found no actionable
issues. Detailed evidence: `E:/EasyToeicC1/task-2-report.md` and
`E:/EasyToeicC1/task-2-review.md`.

The new helper counts vocabulary rows by topic and distinct topic IDs by
collection. It preserves ordering, metadata, duplicate collection output rows,
duplicate vocabulary rows, shared topic IDs, missing references and empty IDs.
Complexity for unique collection IDs is O(V + T + C); duplicate collection rows
repeat their set summation. This is a CPU optimization, not evidence of faster
network requests or rating persistence.

## Repeat Flashcard measurements

Same harness, one warmup and five samples per size. The Flashcard source did not
change. These differences measure noise/warmth as well as host load and **must
not be attributed to a Flashcard optimization**.

| Vocabulary | Navigation+initialization median before/after ms | Mount render median before/after ms | Rating-to-next median before/after ms | Rating render median before/after ms |
|---:|---:|---:|---:|---:|
| 100 | 1350.30 / 1213.88 | 53.30 / 39.20 | 121.30 / 87.70 | 35.80 / 36.10 |
| 1000 | 1203.97 / 1599.30 | 42.50 / 52.80 | 85.80 / 98.50 | 32.70 / 40.60 |
| 5000 | 1728.83 / 1305.63 | 96.10 / 63.70 | 110.40 / 90.70 | 57.80 / 39.00 |

Three rating subtree commits per action in both runs. Mobile Flashcard PNGs have
identical SHA-256; desktop screenshots visually match but are not byte-identical.
No per-child render census, physical mobile device or persisted 5,000-row
Supabase collection was profiled. Raw after data: `integrated-browser-profile.json`.

## Collection CPU before/after

Final repeat: Node 24.15.0, Intel Core i5-10210U, 20 warmup calls, 101 samples,
calibrated batches, alternating original/indexed order, median and nearest-rank
p95 per call. Deterministic fixtures; allocations/GC included, no forced GC.
This is synchronous CPU time, not browser responsiveness. Host load affects
absolute timings. Raw samples and source are retained under `E:/EasyToeicC1`.

| Words / collections / topics | Original median / p95 ms | Indexed median / p95 ms |
|---:|---:|---:|
| 100 / 10 / 10 | 0.0199 / 0.0339 | 0.0070 / 0.0151 |
| 1000 / 10 / 100 | 0.2270 / 0.3562 | 0.0600 / 0.0969 |
| 5000 / 10 / 500 | 1.4924 / 4.6230 | 0.3937 / 0.8325 |
| 100 / 20 / 40 | 0.0358 / 0.0435 | 0.0094 / 0.0115 |
| 1000 / 200 / 400 | 3.6518 / 5.3512 | 0.1135 / 0.1878 |
| 5000 / 1000 / 2000 | 145.1942 / 248.5221 | 0.8789 / 2.1291 |

The collection-heavy distribution demonstrates algorithmic waste. With only ten
collections, absolute savings are small. A production speedup is not established.

## Authenticated Local smoke (before review fixes)

Real Auth/PostgREST at `127.0.0.1:55421`, existing test accounts; zero external
Supabase attempts and no browser page errors. Four modes, typing Enter,
pronunciation UI, one successful rating RPC, zero rating-time Auth getUser calls,
exactly one additional review log and one progress review-count increment,
session restoration after reload, real UI sign-out redirect and disjoint account
vocabulary IDs all passed. Microphone recognition was not tested. One local
rating was saved and retained; accounts/rows were not deleted or reset.

Harness corrections were necessary: typing feedback includes the vocabulary
word, and pronunciation returns through its explicit skip button. Initial smoke
selector failures were harness assumptions, not confirmed application defects.

Controlled delayed aggregates: navigation became usable before aggregates;
controlled HTTP 503 aggregates: core/Flashcard remained usable, unknown metrics
stayed loading rather than being rendered as zero. No application auth logic was
changed in response to a browser harness failure.

## Review findings and resolution

Independent Task3 review found two P2 issues: duplicate initial-session sources
could bypass request deduplication, and a vocabulary text edit could invalidate
initial aggregates without arranging recovery. Both were reproduced with failing
tests and fixed. Startup notifications now share a logical initial load with
tracked timer cleanup (including StrictMode); a successful content edit triggers
replacement aggregate refresh. Re-review independently reproduced both fixes
and reported no remaining findings. Final whole-branch review found no actionable
P0–P3 defects or requirement gaps. Reports: `task-3-review.md`,
`task-3-rereview.md`, `final-review.md` under `E:/EasyToeicC1`.

## Final verification

Final source was unchanged through full verification and final review. Evidence
is in `E:/EasyToeicC1/artifacts/verification-exits.json` and `verified-*.log`.

| Check | Actual result |
|---|---|
| Focused six-file Flashcard/page/Dashboard/core/stats suite | 137 passed; one unchanged baseline snapshot assertion failed |
| Full suite, one worker, default timeouts | 486 passed; exactly six known baseline failures; one build-only test skipped |
| Explicit SheetJS bundle test after successful build | 1 passed |
| Lint, excluding only generated `.next/**` | Exit 0, zero errors, three existing image warnings and existing ESLintIgnoreWarning |
| `tsc --noEmit --incremental false` | Exit 0 |
| Production build, local-only Supabase URL/key | Exit 0; 15/15 static pages generated |
| `git diff --check` | Passed |

The earlier ordinary `npm run lint` also completed with exit 0 and the same three
warnings. Build does not substitute for lint. The temporary profiling route was
moved out of the source tree; a fresh build regenerated types, and ordinary
typecheck now succeeds without a special exclusion.

Known failures are unchanged assertions in `progressService.test.ts` TEST 4, 5,
6, 7, 9, plus `appDataService.test.ts` "still rejects when core data fails".
The latter expects aggregates never to start on core failure, while the retained
compatibility API starts requests concurrently. No baseline assertion was removed
or weakened. No new failing tests remain. There are 87 additional passing tests
versus the Phase B suite (399 → 486).

Initial `/app` production bundle: 11 chunks, 880,765 raw / 250,336 gzip bytes;
SheetJS absent. Phase B reference is 878,821 raw / 249,813 gzip bytes. The modest
increase is documented; C1 is not a bundle-size optimization.

## Final authenticated browser recheck

After both review fixes, real Auth/PostgREST smoke passed again: all four modes,
typing Enter, pronunciation UI, one rating RPC/HTTP 200, zero rating-time
`/auth/v1/user` requests, exactly one review log and one review-count increment,
reload/session restoration, real UI logout redirect and account isolation. No
browser page errors or attempted external Supabase requests. Evidence:
`auth-smoke.json` and `final-auth-smoke.log`. Two local ratings were saved across
the pre-fix and final verification runs; all test records/accounts were retained.

Final delayed/failing aggregate browser cases each observed exactly one GET for
collections, topics and vocabularies. Both allowed Flashcard use with unknown
metrics still represented by loading placeholders. Final failure case: core
response 2,060 ms, learning navigation available 2,350 ms, aggregate readiness
unknown (controlled HTTP 503). No false zero values or page errors were observed.

The final delayed sample included server recompilation: core 10,830 ms,
aggregates 13,680 ms, learning navigation 11,109 ms, aggregate UI ready 13,991 ms.
Do not compare those absolute navigation times with the warm baseline. The
observable behavior is that core-to-navigation wait was approximately 279 ms
after the change versus 3,189 ms in the baseline controlled-delay sample, and
navigation was usable about 2.57 seconds before the final aggregate response.
These single local samples establish the removal of aggregate gating, not a
statistical production latency improvement. The controlled test delay is 3 s.

Desktop/mobile Dashboard screenshots were inspected for loaded and failed states;
loaded layout/branding match baseline. Existing Flashcard markup/styles/SRS code
are unchanged. Snapshot files, benchmark scripts and detailed reports remain on
E:, with existing Playwright browser binaries on D:.

## Exact intended files

- `app/app/page.tsx`
- `app/app/page.rating.test.tsx`
- `app/app/page.loading.test.tsx`
- `components/Dashboard.tsx`
- `components/Dashboard.loading.test.tsx`
- `components/Navbar.tsx`
- `services/appDataService.ts`
- `services/appDataService.test.ts`
- `lib/data/collectionStats.ts`
- `lib/data/collectionStats.test.ts`
- `docs/superpowers/plans/2026-11-16-flashcard-phase-c1.md`
- `docs/superpowers/plans/2026-11-16-flashcard-phase-c1-execution.md`

## Limits and handoff

No overall Flashcard/rating latency improvement is claimed. Browser profiling
used a development build and controlled memory fixtures, not 5,000 persisted
Supabase rows; production hardware/network behavior remains unmeasured. No real
microphone, physical mobile device, multi-tab or cross-timezone matrix was run.
Collection CPU results do not prove browser speed gains for ordinary small
collections. Six baseline tests and existing lint warnings remain follow-up work.

Potential later investigation is deeper production-like browser profiling if
real-user evidence justifies it; no Phase C2 extraction or broad state rewrite
was performed. Local integration and any push/deployment require a separate
instruction. No Supabase, migration, dependency, Phase 1 or main changes.

The local commit is to be identified by the final handoff and Git history; this
report cannot contain its own commit hash. All new worktree/generated evidence
and dependencies are on D:/E:. Existing C: worktrees were preserved.

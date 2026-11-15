# Flashcard correctness Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

Coordinator directs subagent-driven implementation and independent review. This worker executes its assigned tasks inline, spawns no agents, and makes no commits. Coordinator decides whether to make a conditionally authorized local commit after verification and review.

**Goal:** Restore native keyboard control and generate full distinct quiz choices when the pool permits.
**Architecture:** Guard the existing global listener and keep typing Enter local. Deduplicate the meaning pool before seeded sampling, preserving the correct label and existing seed strings.
**Tech Stack:** React 19, TypeScript, Vitest, jsdom.
**Spec:** User Phase A request; docs/SRS_TARGET_SPEC.md.

## Global Constraints
Preserve markup/styles, authoritative SRS writes, pending retries, session recovery and queue transitions. No dependency installation, push, merge or production connections. Worker must not spawn agents or commit. Preserve concurrent smoke scratch.

## Task 1: Keyboard correctness
- [x] Add components/FlashcardMode.test.tsx using existing React act/createRoot DOM patterns. Reproduce Enter on focused button changing exercise, global Tab prevention, interactive descendants, dialogs, modifier/composition/repeat handling, and typing input Enter.
- [x] Run `npx vitest run components/FlashcardMode.test.tsx` and record assertion failures before implementation.
- [x] In components/FlashcardMode.tsx reject defaultPrevented, modified, composing, repeated events and interactive targets/ancestors. Remove Tab branch. Keep body/context Space, Enter and quiz digits. Guard input-local Enter and prevent bubbling/double handling.
- [x] Run focused tests; confirm native events are not canceled and exercise/feedback state remains correct.

## Task 2: Quiz correctness
- [x] Add rendered quiz regression with duplicate/case/whitespace meanings and enough unique alternatives; expect four normalized unique labels and one correct answer. Cover small pools and deterministic rerender.
- [x] Observe RED against existing sampling-before-dedup code.
- [x] Deduplicate `[currentVocab.meaning, ...distractors]` first, remove the first correct entry from the distractor pool, then seeded shuffle/slice and seeded choice shuffle.
- [x] Rerun component and existing lib/quiz tests.

## Task 3: Verification
- [x] Run full suite, compare the six known baseline failures; run lint, typecheck and build with localhost/dummy public Supabase variables.
- [x] Review diff for scope and report exact files, RED evidence and check results. Coordinator owns independent review and smoke environment.


## Verification evidence
- Baseline RED before source changes: 23 failed, 3 passed (26 component tests). Quiz rendered one choice despite four distinct meanings. Focused button Enter, Tab/ShiftTab, interactive descendants, modifiers/composition/repeat and typing-local Enter failed assertions.
- Additional context RED: 1 failed, 27 passed; role=region must retain shortcuts. Additional invalid-meaning RED: 1 failed, 28 passed; blank correct meaning produced two invalid/misleading choices.
- Final focused run excluding coordinator scratch: 36 passed (31 component tests plus 5 existing quiz tests).
- Full suite excluding `.superpowers` smoke runtime: 371 tests, 365 passed, same 6 baseline failures (progressService TEST 4/5/6/7/9 and appDataService core failure). Unfiltered npm test also discovers the smoke copy and duplicates baseline failures (711 tests, 699 passed, 12 failed); scratch remains untouched.
- Typecheck passed after build completed. A concurrent attempt failed when build replaced generated `.next/types`; sequential rerun passed.
- Build attempted using localhost Supabase URL and dummy public anon key. Default invocation fails resolving cross-drive Next client paths through the node_modules junction. Symlink-preserving retry fails in Next flight loader reading createFilename. Build remains an environment limitation; no configuration/dependencies changed.
- No worker commit, push, merge, dependency installation, or subagent dispatch. No markup/style or SRS persistence/queue edits. No Tab keyboard hint copy existed.
- Final lint: `npm run lint -- --ignore-pattern '.superpowers/**' --ignore-pattern '.next/**'` passed, 0 errors and 3 existing img warnings, plus existing ESLintIgnoreWarning. Original npm run lint passed before generated build/smoke trees appeared; later runs exclude only those scratch/generated trees.
- `git diff --check` passed. Restored only worker-generated tracked tsconfig.tsbuildinfo bytes from HEAD; final changes are the component, component tests, and this plan.

## Coordinator final verification
- Replaced cross-drive dependency junction with a worktree-local exact-lockfile npm ci installation; package manifests unchanged. Production build passed (15/15 static pages), using localhost API URL and a dummy public anon key; no production access.
- Fresh focused invocation: 41 tests passed across 5 files. Fresh full suite excluding only ignored copied smoke runtime: 365 passed, 6 unchanged baseline failures.
- Fresh lint excluding ignored smoke runtime: exit 0, zero errors and three existing image warnings. Typecheck with incremental false: exit 0.
- Authenticated local smoke and eight byte-identical desktop/mobile screenshot pairs recorded in ignored .superpowers/flashcard-phase-a/report.md. Baseline reconstructed from exact Git baseline source; no real microphone recognition tested.

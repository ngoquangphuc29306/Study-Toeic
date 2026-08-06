# TOEIC Test Phase 11 — Listening CBT and Media Policy

Phase 11 adds the interaction policy that was missing from the Phase 10.5
presentation layer. It deliberately keeps the Phase 10.5 layout, tokens,
header/footer, two-column workspace and signed-media boundary unchanged.

## Scope and preservation

This phase changes only client-side media/navigation orchestration and pure
policy contracts. It does not change the database, RPCs, attempt snapshot,
answer/flag autosave, resume, abandon, submit/scoring, review, history,
vocabulary, SRS, importer, RLS, or answer-key isolation.

The browser still receives only safe question content and short-lived signed
media URLs. Media state is ephemeral and is never included in answer autosave.

## Approved behavior

### Practice

Practice remains flexible inside the selected snapshot. Previous/Next, Part
navigation, palette navigation, play/pause, seek, replay, mute and the approved
speed values `0.8x`, `1.0x`, `1.2x`, and `1.5x` remain available. Practice does
not auto-advance on media end and does not auto-submit.

### Exam Listening Parts 1–4

The current media item is started by an explicit user action when autoplay is
not available. Once playback starts, pause, seek, progress-bar interaction,
speed changes and replay are blocked. Playback rate is forced to `1.0x`.
Mute remains available. The server deadline continues to run.

Previous/Next, Part tabs, palette jumps and ArrowLeft/ArrowRight cannot bypass
the Listening sequence. The only forward transition is an `ended` media event.
An autoplay rejection on the next item is treated as a browser policy outcome;
the visible Play control remains available.

Part 1 and Part 2 render only the A/B/C/D labels during Exam. Option content is
still present in the safe DTO and is rendered in Practice; it is not deleted or
used for scoring on the client. Practice feedback is not rendered in Exam.

### Shared Listening groups

Parts 3 and 4 use the production passage relationship. A group gets one stable
media identity in this order:

1. passage ID;
2. canonical relative audio path;
3. question ID.

Signed URLs, question-number ranges and React indexes are never identities.
The Workspace renders one audio source for a shared passage. Selecting another
question in the same group does not change the media key or remount the audio.
When the group ends, the dispatcher advances to the next group in snapshot
order. Duplicate `ended` callbacks are ignored.

### Exam Reading Parts 5–7

After the Listening boundary, Reading navigation is flexible within Parts 5–7:
Previous/Next, palette and Part tabs are allowed. A target in Parts 1–4 is
rejected. Passage grouping remains data-driven by `passageId`, including the
dataset-defined group sizes used by Parts 6 and 7.

## Policy contracts

`features/toeic-tests/services/toeicMediaPlaybackPolicy.ts` is pure and returns
the control capabilities for a mode/Part/media lifecycle. It is the source for
play, pause, seek, replay, speed, mute, forced rate and auto-advance behavior.

`features/toeic-tests/services/toeicNavigationPolicy.ts` is pure and returns an
allow/deny decision for Previous, Next, palette jump, Part jump, same-group
question selection and media auto-advance. Buttons are disabled for affordance,
but the dispatcher and policy enforce the rule independently of CSS or button
state.

`features/toeic-tests/services/toeicMediaGroup.ts` provides stable group keys.
`features/toeic-tests/hooks/useToeicExamMediaController.ts` tracks only
ephemeral media status (`idle`, `loading`, `ready`, `playing`, `ended`,
`error`), start/end state and the last naturally-played time used to restore a
forbidden seek.

## Workspace wiring

`ToeicAttemptWorkspace` now sends all navigation entry points through
`requestToeicNavigation`:

- Part tabs;
- footer Previous/Next;
- palette clicks;
- ArrowLeft/ArrowRight;
- selecting a question inside a shared group;
- media-ended transition.

The media view receives `mode`, `part`, `mediaKey`, policy and lifecycle
callbacks. The existing signed-media retry and image lightbox remain in place.

## Keyboard and accessibility

The existing A/B/C/D, 1–4 and F shortcuts remain. Navigation shortcuts now
respect the same policy as buttons and are ignored inside inputs, textareas,
selects, buttons, contenteditable regions, dialogs and interactive editors.
Locked actions expose disabled affordances and a single inline live status using
the existing workspace styling; no repeated toast or animation was added.

The Exam progress range is read-only/disabled, speed is disabled at `1.0x`, and
mute remains an operable labelled control. Browser autoplay rejection is not
presented as a technical application error.

## Tests and verification

Added pure tests cover:

- Practice full media controls;
- Exam Listening before/during/after playback;
- forced `1.0x`, mute and denied seek/pause/replay;
- Practice/Exam navigation boundaries;
- Listening auto-advance and Part 4 → Reading transition;
- Reading navigation and Listening back-jump rejection;
- shared passage identity and fallbacks.

The full application test suite is the authoritative automated check. Browser
manual verification remains required for real autoplay, seeking events,
mobile viewport behavior and signed media playback in Chromium and Mobile
Safari; those checks must be recorded before changing the parity matrix rows to
`COMPLETE`.

## Deferred work

This phase does not implement custom Exam duration, official 10–990 scoring,
analytics aggregates, total-duration aggregates, vocabulary summaries on
catalog cards, server pause/deadline changes, auto-submit, offline queue,
multi-tab coordination, entitlement, licensing workflow, freehand annotation,
dictionary provider integration or new UI redesign.


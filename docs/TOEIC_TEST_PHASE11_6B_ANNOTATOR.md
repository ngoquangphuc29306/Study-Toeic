# TOEIC Test Phase 11.6B — Annotator Completion

## Scope

Phase 11.6B completes the existing floating Annotator in the Practice workspace. The approved toolbar and workspace layout remain unchanged. Annotation state is independent of answers, autosave, timer, submit, scoring, SRS and review scheduling.

Review pages do not currently mount the Annotator surface. This phase therefore keeps the existing product boundary: saved annotations remain available from Practice for the published test, while Review Annotator availability is deferred until Review has an explicit annotation target and interaction contract.

## Audit before implementation

| Area | Existing behavior before Phase 11.6B |
|---|---|
| Model | `toeic_text_annotations`, one question XOR one passage target |
| Persisted fields | user/test/question/passage/document index, start/end offsets, quote, style, comment, timestamps |
| Supported tools | selection, highlight, underline, saved annotation list, single-item delete, movable toolbar |
| Disabled tools | pen, eraser, text, sticky note, rectangle, arrow, undo, redo, show/hide, delete-current-question, color and stroke width |
| Ownership/RLS | `auth.uid()` owner checks, RLS enabled and forced, direct table mutation revoked, RPC-only writes |
| Keyboard boundary | workspace handled A–D, 1–4, ArrowLeft/ArrowRight and F; inputs, buttons, dialogs, notes and interactive editors were excluded |
| Review | `ToeicAttemptReviewPage` has no Annotator toolbar or annotation target |

## Server contract

Migration `20260809130000_complete_toeic_annotator.sql` extends the existing table without changing the old migration:

- `annotation_type`: `highlight`, `underline`, `pen`, `text`, `sticky`, `rectangle`, `arrow`;
- `color`: validated six-digit hex color;
- `stroke_width`: integer from 1 to 12;
- `geometry`: validated JSONB with normalized coordinates in `[0, 1]`;
- `text_content`: plain text up to 500 characters.

The existing `get_toeic_annotations` and `create_toeic_annotation` contracts remain compatible. New rich tools use `create_toeic_annotator_annotation`. The RPC validates authentication, published test, target ownership/context, allowlists, coordinate bounds, point count, text length and comment length. No browser direct table mutation is introduced.

Geometry is normalized to its target surface rather than persisted in pixels. This makes the annotation portable across desktop/mobile viewport sizes. Shape rows use the internal quote marker `[annotation]`; the renderer never displays that marker as text.

## Implemented tools

- Mouse/select (`M`)
- Highlight (`H`)
- Underline (`U`)
- Pen/freehand (`B`)
- Eraser (`E`)
- Text (`T`)
- Sticky note (`S`)
- Rectangle (`R`)
- Arrow (`W`)
- Color selector and preset colors
- Stroke width selector: thin, medium, thick, very thick
- Undo (`Ctrl/Cmd+Z` through the server-backed action history)
- Redo (`Ctrl/Cmd+Shift+Z` through the server-backed action history)
- Show/hide (`V`), local UI visibility state only
- Delete current question (`X`), persisted deletion through the existing owner RPC
- Saved annotation list in the existing toolbar side panel

Text annotations continue to use stable quote/offset anchoring. Rich drawings use normalized geometry, are rendered in the existing content surface, and are filtered by the active question context.

## Client flow

1. The user selects a tool in the existing floating toolbar.
2. The workspace updates the active tool, color and stroke width.
3. Selection tools submit quote/offset data; drawing tools submit normalized geometry.
4. The browser calls the typed `toeicToolService` boundary.
5. The RPC returns the canonical saved row.
6. The workspace commits that row to annotation state and the Annotator overlay renders it.
7. Undo deletes the saved row; redo creates a new server row from the prior canonical payload.

No annotation action updates `answers`, `autosave`, `practiceFeedback`, `remaining`, submit state or score state.

## Accessibility and resilience

- All toolbar controls are native buttons with labels, titles and pressed/disabled states.
- Color and stroke controls have programmatic labels.
- Text/sticky input has a label, focus on open, length limit and cancel action.
- The movable toolbar still has keyboard arrow movement in addition to pointer dragging.
- Drawing state is scoped to the current page session; persisted geometry is server-authoritative.
- Errors are surfaced in an alert region instead of silently dropping a save/delete action.
- The eraser only deletes a hit-tested persisted shape; it never changes answer content.

## Tests and verification

- `toeicAnnotator.test.ts`: allowlisted tools, normalized geometry and invalid-input rejection.
- `toeicToolService.test.ts`: rich geometry validation before RPC and response mapping.
- Existing anchoring, mapper and tool tests remain green.
- `toeic_phase11_6b_annotator_verification.sql`: table columns, RPC, direct mutation revocation, owner policy and type constraint.

Manual checklist:

1. Open a published Test 1 Practice attempt.
2. Open Annotator and draw a pen stroke, rectangle and arrow.
3. Add a text annotation and sticky note; reload and confirm they remain in the same question.
4. Select text, save highlight and underline, then switch question and return.
5. Change color/stroke width and confirm new annotations use the selected values.
6. Use eraser, delete selected annotation and delete current-question annotations.
7. Use undo/redo and verify only annotation rows change.
8. Toggle visibility and use `M/H/U/B/E/T/S/R/W/V/X` outside inputs/dialogs.
9. Verify answer, flag, timer, autosave, submit and review behavior is unchanged.
10. Repeat at a narrow mobile viewport and after a refresh.

## Deferred

- Review-mode Annotator UI until the Review route exposes an approved annotation surface.
- Annotation editing/dragging after save.
- Multi-user collaboration or cross-tab live synchronization.
- Dictation, Flip, Dictionary Lookup, analytics and scoring changes.

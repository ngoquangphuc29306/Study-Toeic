# TOEIC Test Phase 11.6A — Rich Notes

## Scope

Phase 11.6A upgrades the existing TOEIC Notes panel from a plain-text textarea to a compact rich editor. The existing panel, drawer placement, note scope, owner checks, save action and delete action remain unchanged.

Implemented formatting:

- Inline: bold, italic and strikethrough.
- Block: paragraph, bulleted list, numbered list and checklist.
- Keyboard: `Ctrl/Cmd+B` and `Ctrl/Cmd+I` while the editor has focus.

The editor uses native browser editing commands only as an ephemeral editing mechanism. HTML is never the canonical persisted format.

## Existing flow audited

1. `ToeicAttemptWorkspace` opens the existing Notes tool in the right-side learning-tools panel.
2. `ToeicNotesPanel` loads all notes for the published test through `get_toeic_notes`.
3. The current question note is selected by `questionId`; when no question is selected, the test-level note is selected.
4. Save calls the existing `upsert_toeic_note` RPC through `toeicToolService`.
5. Delete calls the existing `delete_toeic_note` RPC.
6. Notes remain available after reload and on another authenticated device because Supabase remains the authority.
7. The workspace keyboard handler already excludes `input`, `textarea`, `contenteditable`, dialogs and the existing interactive-editor boundary. The rich editor uses `data-toeic-interactive-editor` as part of that same boundary.

No answer, score, timer, submission, SRS or vocabulary data is read or written by the Notes flow.

## Canonical storage format

The existing `toeic_test_notes.content` text column remains the persistence boundary. New notes are stored as compact JSON with this shape:

```ts
type ToeicRichNoteDocument = {
  version: 1;
  blocks: Array<
    | { type: 'paragraph'; children: Array<{ text: string; marks: Array<'bold' | 'italic' | 'strike'> }> }
    | { type: 'bulleted-list' | 'numbered-list'; items: Array<{ children: Array<...> }> }
    | { type: 'checklist'; items: Array<{ children: Array<...>; checked: boolean }> }
  >;
};
```

The runtime mapper accepts only this version and these node/mark types. It renders text through escaped HTML and does not accept arbitrary HTML, scripts, links, embeds or answer-related fields.

The visible text limit remains 5,000 characters. A new migration raises only the storage payload ceiling to 20,000 characters so formatting metadata does not make a valid 5,000-character note fail at the database boundary. The existing RPC name, ownership behavior and note scope are preserved.

## Legacy compatibility

Existing plain-text rows are not rewritten during read. The mapper converts them in memory to one paragraph document, so old notes remain readable. The next save upgrades that note to the canonical JSON representation. A legacy value that resembles invalid JSON is treated as plain text and is still rendered as text, never as HTML.

## Security and authority

- User ownership remains enforced by `auth.uid()` in the existing security-definer RPCs and RLS policy.
- The browser still cannot insert or update the notes table directly.
- The service validates UUIDs, visible text length and canonical document serialization before calling the RPC.
- The rich document schema has no fields for correct answers, `isCorrect`, scoring, transcripts or answer keys.
- No localStorage, sessionStorage or IndexedDB is used as an authority or offline note store.
- Notes remain isolated from answer autosave, practice feedback, submission and result scoring.

## Accessibility and interaction

The toolbar reuses the existing Notes surface and tokens. Each control is a native button with an accessible label, title, pressed state and visible focus ring. The editor exposes `role="textbox"`, `aria-multiline="true"` and an accessible label. Workspace shortcuts remain disabled while focus is inside the editor or toolbar.

The toolbar is intentionally compact and does not introduce a new modal, drawer, route or design system. Undo/redo and link/embed controls are not included in this phase.

## Changed files

- `features/toeic-tests/services/toeicRichNote.ts` — canonical document types, normalization, legacy parsing, safe HTML projection and checklist conversion.
- `features/toeic-tests/services/toeicRichNote.test.ts` — model and storage-format tests.
- `features/toeic-tests/toolContracts.ts` — note DTO now carries the runtime-safe parsed document in addition to stored content.
- `features/toeic-tests/mappers/toeicToolMapper.ts` — maps legacy and rich note content safely.
- `features/toeic-tests/services/toeicToolService.ts` — canonicalizes content before the existing upsert RPC.
- `features/toeic-tests/services/toeicToolService.test.ts` — verifies canonical JSON reaches the existing RPC.
- `features/toeic-tests/components/ToeicLearningToolsPanel.tsx` — compact rich toolbar and contenteditable editor in the existing Notes panel.
- `supabase/migrations/20260809100000_expand_toeic_note_payload.sql` — raises only the notes payload limit and preserves the existing RPC boundary.

## Deferred

This phase does not add collaboration, offline sync, multi-tab conflict resolution, undo/redo history, links, images, attachments, annotations, dictation, lookup, analytics or any scoring/SRS behavior.

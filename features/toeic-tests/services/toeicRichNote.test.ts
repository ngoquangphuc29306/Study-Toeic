import { describe, expect, it } from 'vitest';
import {
  createToeicRichNoteDocumentFromText,
  getToeicRichNotePlainText,
  isToeicRichNoteEmpty,
  normalizeToeicRichNoteDocument,
  parseStoredToeicNoteContent,
  serializeToeicRichNoteDocument,
} from './toeicRichNote';

describe('TOEIC rich note document', () => {
  it('keeps legacy plain-text notes readable', () => {
    const document = parseStoredToeicNoteContent('Review the listening clue');
    expect(getToeicRichNotePlainText(document)).toBe('Review the listening clue');
    expect(document.blocks[0]?.type).toBe('paragraph');
  });

  it('serializes the supported inline marks and block types without HTML', () => {
    const document = normalizeToeicRichNoteDocument({
      version: 1,
      blocks: [
        { type: 'paragraph', children: [{ text: 'Important', marks: ['bold'] }] },
        { type: 'bulleted-list', items: [{ children: [{ text: 'Listen', marks: ['italic'] }] }] },
        { type: 'numbered-list', items: [{ children: [{ text: 'Review', marks: ['strike'] }] }] },
        { type: 'checklist', items: [{ children: [{ text: 'Complete', marks: [] }], checked: true }] },
      ],
    });
    expect(document).not.toBeNull();
    const serialized = serializeToeicRichNoteDocument(document!);
    expect(serialized).not.toContain('<strong>');
    expect(parseStoredToeicNoteContent(serialized)).toEqual(document);
    expect(getToeicRichNotePlainText(document!)).toContain('Complete');
  });

  it('rejects unsupported document nodes and empty content at the model boundary', () => {
    expect(normalizeToeicRichNoteDocument({ version: 1, blocks: [{ type: 'heading', children: [] }] })).toBeNull();
    expect(isToeicRichNoteEmpty(createToeicRichNoteDocumentFromText('   '))).toBe(true);
  });
});

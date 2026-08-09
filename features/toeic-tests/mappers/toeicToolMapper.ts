import {
  ToeicToolError,
  type DictionaryLookupResult,
  type ToeicAnnotationStyle,
  type ToeicNote,
  type ToeicTextAnnotation,
} from '../toolContracts';
import { parseStoredToeicNoteContent } from '../services/toeicRichNote';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ToeicToolError('INVALID_RESPONSE', message);
  return value as Record<string, unknown>;
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ToeicToolError('INVALID_RESPONSE', `Invalid TOEIC ${field}`);
  return value;
}

function nullableUuid(value: unknown, field: string): string | null {
  return value === null ? null : uuid(value, field);
}

function iso(value: unknown, field: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new ToeicToolError('INVALID_RESPONSE', `Invalid TOEIC ${field}`);
  return value;
}

function text(value: unknown, field: string, allowNull = false): string | null {
  if (allowNull && value === null) return null;
  if (typeof value !== 'string') throw new ToeicToolError('INVALID_RESPONSE', `Invalid TOEIC ${field}`);
  return value;
}

function mapNote(value: unknown): ToeicNote {
  const row = object(value, 'Invalid TOEIC note response');
  const content = text(row.content, 'note content') as string;
  return { id: uuid(row.id, 'note id'), testId: uuid(row.testId, 'test id'), questionId: nullableUuid(row.questionId, 'question id'), content, document: parseStoredToeicNoteContent(content), createdAt: iso(row.createdAt, 'created time'), updatedAt: iso(row.updatedAt, 'updated time') };
}

export function mapToeicNotesResponse(value: unknown): ReadonlyArray<ToeicNote> {
  if (!Array.isArray(value)) throw new ToeicToolError('INVALID_RESPONSE', 'Invalid TOEIC notes response');
  return value.map(mapNote);
}

function mapAnnotation(value: unknown): ToeicTextAnnotation {
  const row = object(value, 'Invalid TOEIC annotation response');
  const style = row.style;
  if (style !== 'highlight' && style !== 'underline') throw new ToeicToolError('INVALID_RESPONSE', 'Invalid TOEIC annotation style');
  const startOffset = row.startOffset;
  const endOffset = row.endOffset;
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || (startOffset as number) < 0 || (endOffset as number) <= (startOffset as number)) throw new ToeicToolError('INVALID_RESPONSE', 'Invalid TOEIC annotation offsets');
  const questionId = nullableUuid(row.questionId, 'question id');
  const passageId = nullableUuid(row.passageId, 'passage id');
  if ((questionId === null) === (passageId === null)) throw new ToeicToolError('INVALID_RESPONSE', 'Invalid TOEIC annotation target');
  return { id: uuid(row.id, 'annotation id'), testId: uuid(row.testId, 'test id'), questionId, passageId, documentIndex: row.documentIndex === null ? null : Number.isInteger(row.documentIndex) ? row.documentIndex as number : (() => { throw new ToeicToolError('INVALID_RESPONSE', 'Invalid annotation document index'); })(), startOffset: startOffset as number, endOffset: endOffset as number, quote: text(row.quote, 'annotation quote') as string, style: style as ToeicAnnotationStyle, comment: text(row.comment, 'annotation comment', true), createdAt: iso(row.createdAt, 'created time'), updatedAt: iso(row.updatedAt, 'updated time') };
}

export function mapToeicAnnotationsResponse(value: unknown): ReadonlyArray<ToeicTextAnnotation> {
  if (!Array.isArray(value)) throw new ToeicToolError('INVALID_RESPONSE', 'Invalid TOEIC annotations response');
  return value.map(mapAnnotation);
}

export function mapDictionaryLookupResponse(value: unknown): DictionaryLookupResult {
  const row = object(value, 'Invalid dictionary response');
  const list = (item: unknown, field: string): ReadonlyArray<string> => {
    if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) throw new ToeicToolError('INVALID_RESPONSE', `Invalid dictionary ${field}`);
    return item as string[];
  };
  return { term: text(row.term, 'lookup term') as string, phonetic: text(row.phonetic, 'phonetic', true), partOfSpeech: text(row.partOfSpeech, 'part of speech', true), definitions: list(row.definitions, 'definitions'), examples: list(row.examples, 'examples') };
}

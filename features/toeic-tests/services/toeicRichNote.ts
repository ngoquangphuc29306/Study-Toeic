export const TOEIC_NOTE_MAX_TEXT_LENGTH = 5000;
export const TOEIC_NOTE_MAX_SERIALIZED_LENGTH = 20000;

export type ToeicRichNoteMark = 'bold' | 'italic' | 'strike';
export type ToeicRichNoteBlockType = 'paragraph' | 'bulleted-list' | 'numbered-list' | 'checklist';

export interface ToeicRichNoteText {
  text: string;
  marks: ReadonlyArray<ToeicRichNoteMark>;
}

export interface ToeicRichNoteListItem {
  children: ReadonlyArray<ToeicRichNoteText>;
  checked?: boolean;
}

export type ToeicRichNoteBlock =
  | { type: 'paragraph'; children: ReadonlyArray<ToeicRichNoteText> }
  | { type: 'bulleted-list'; items: ReadonlyArray<ToeicRichNoteListItem> }
  | { type: 'numbered-list'; items: ReadonlyArray<ToeicRichNoteListItem> }
  | { type: 'checklist'; items: ReadonlyArray<ToeicRichNoteListItem> };

export interface ToeicRichNoteDocument {
  version: 1;
  blocks: ReadonlyArray<ToeicRichNoteBlock>;
}

const MARK_ORDER: ReadonlyArray<ToeicRichNoteMark> = ['bold', 'italic', 'strike'];
const MARKS = new Set<ToeicRichNoteMark>(MARK_ORDER);

function mergeTextRuns(runs: ReadonlyArray<ToeicRichNoteText>): ReadonlyArray<ToeicRichNoteText> {
  const result: ToeicRichNoteText[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const marks = MARK_ORDER.filter((mark) => run.marks.includes(mark));
    const previous = result[result.length - 1];
    if (previous && previous.marks.join('|') === marks.join('|')) {
      result[result.length - 1] = { ...previous, text: previous.text + run.text };
    } else {
      result.push({ text: run.text, marks });
    }
  }
  return result;
}

function normalizeRuns(value: unknown): ReadonlyArray<ToeicRichNoteText> | null {
  if (!Array.isArray(value)) return null;
  const runs: ToeicRichNoteText[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as { text?: unknown; marks?: unknown };
    if (typeof row.text !== 'string') return null;
    const marks = row.marks === undefined ? [] : row.marks;
    if (!Array.isArray(marks) || !marks.every((mark) => typeof mark === 'string' && MARKS.has(mark as ToeicRichNoteMark))) return null;
    runs.push({ text: row.text, marks: MARK_ORDER.filter((mark) => (marks as string[]).includes(mark)) });
  }
  return mergeTextRuns(runs);
}

function normalizeItems(value: unknown, checklist: boolean): ReadonlyArray<ToeicRichNoteListItem> | null {
  if (!Array.isArray(value)) return null;
  const items: ToeicRichNoteListItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as { children?: unknown; checked?: unknown };
    const children = normalizeRuns(row.children);
    if (!children || (checklist && row.checked !== undefined && typeof row.checked !== 'boolean')) return null;
    items.push(checklist ? { children, checked: row.checked === true } : { children });
  }
  return items;
}

export function normalizeToeicRichNoteDocument(value: unknown): ToeicRichNoteDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as { version?: unknown; blocks?: unknown };
  if (row.version !== 1 || !Array.isArray(row.blocks) || row.blocks.length > 100) return null;
  const blocks: ToeicRichNoteBlock[] = [];
  for (const block of row.blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
    const item = block as { type?: unknown; children?: unknown; items?: unknown };
    if (item.type === 'paragraph') {
      const children = normalizeRuns(item.children);
      if (!children) return null;
      blocks.push({ type: 'paragraph', children });
    } else if (item.type === 'bulleted-list' || item.type === 'numbered-list') {
      const items = normalizeItems(item.items, false);
      if (!items) return null;
      blocks.push({ type: item.type, items });
    } else if (item.type === 'checklist') {
      const items = normalizeItems(item.items, true);
      if (!items) return null;
      blocks.push({ type: 'checklist', items });
    } else {
      return null;
    }
  }
  const document = { version: 1 as const, blocks };
  return getToeicRichNotePlainText(document).length <= TOEIC_NOTE_MAX_TEXT_LENGTH ? document : null;
}

export function createEmptyToeicRichNoteDocument(): ToeicRichNoteDocument {
  return { version: 1, blocks: [{ type: 'paragraph', children: [] }] };
}

export function createToeicRichNoteDocumentFromText(value: string): ToeicRichNoteDocument {
  const text = value.replace(/\r\n?/g, '\n');
  return { version: 1, blocks: [{ type: 'paragraph', children: text ? [{ text, marks: [] }] : [] }] };
}

export function getToeicRichNotePlainText(document: ToeicRichNoteDocument): string {
  return document.blocks.map((block) => {
    if (block.type === 'paragraph') return block.children.map((run) => run.text).join('');
    return block.items.map((item) => item.children.map((run) => run.text).join('')).join('\n');
  }).join('\n');
}

export function isToeicRichNoteEmpty(document: ToeicRichNoteDocument): boolean {
  return getToeicRichNotePlainText(document).trim().length === 0;
}

export function serializeToeicRichNoteDocument(document: ToeicRichNoteDocument): string {
  const normalized = normalizeToeicRichNoteDocument(document);
  if (!normalized) throw new Error('Invalid rich note document');
  const serialized = JSON.stringify(normalized);
  if (serialized.length > TOEIC_NOTE_MAX_SERIALIZED_LENGTH) throw new Error('Rich note payload is too large');
  return serialized;
}

export function parseStoredToeicNoteContent(value: string): ToeicRichNoteDocument {
  try {
    const parsed: unknown = JSON.parse(value);
    const document = normalizeToeicRichNoteDocument(parsed);
    if (document) return document;
  } catch {
    // Existing notes are plain text. They remain readable during the format migration.
  }
  return createToeicRichNoteDocumentFromText(value);
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function renderRuns(runs: ReadonlyArray<ToeicRichNoteText>): string {
  return runs.map((run) => {
    let value = escapeHtml(run.text).replaceAll('\n', '<br>');
    if (run.marks.includes('bold')) value = `<strong>${value}</strong>`;
    if (run.marks.includes('italic')) value = `<em>${value}</em>`;
    if (run.marks.includes('strike')) value = `<s>${value}</s>`;
    return value;
  }).join('') || '<br>';
}

export function richNoteDocumentToHtml(document: ToeicRichNoteDocument): string {
  return document.blocks.map((block) => {
    if (block.type === 'paragraph') return `<p>${renderRuns(block.children)}</p>`;
    if (block.type === 'bulleted-list' || block.type === 'numbered-list') {
      const tag = block.type === 'bulleted-list' ? 'ul' : 'ol';
      return `<${tag}>${block.items.map((item) => `<li>${renderRuns(item.children)}</li>`).join('')}</${tag}>`;
    }
    return `<ul data-toeic-list="checklist">${block.items.map((item) => `<li><input type="checkbox" contenteditable="false" data-toeic-checklist-box="true" ${item.checked ? 'checked' : ''}><span>${renderRuns(item.children)}</span></li>`).join('')}</ul>`;
  }).join('') || '<p><br></p>';
}

function marksForElement(element: Element, inherited: ReadonlyArray<ToeicRichNoteMark>): ReadonlyArray<ToeicRichNoteMark> {
  const marks = new Set(inherited);
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') marks.add('bold');
  if (tag === 'em' || tag === 'i') marks.add('italic');
  if (tag === 's' || tag === 'strike' || tag === 'del') marks.add('strike');
  return MARK_ORDER.filter((mark) => marks.has(mark));
}

function readInline(node: Node, inherited: ReadonlyArray<ToeicRichNoteMark> = []): ToeicRichNoteText[] {
  if (node.nodeType === Node.TEXT_NODE) return [{ text: node.nodeValue ?? '', marks: inherited }];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const element = node as Element;
  if (element.tagName.toLowerCase() === 'input') return [];
  if (element.tagName.toLowerCase() === 'br') return [{ text: '\n', marks: inherited }];
  const marks = marksForElement(element, inherited);
  return Array.from(element.childNodes).flatMap((child) => readInline(child, marks));
}

function readListItems(element: Element, checklist: boolean): ReadonlyArray<ToeicRichNoteListItem> {
  return Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li').map((child) => {
    const checkbox = checklist ? child.querySelector('input[data-toeic-checklist-box="true"]') : null;
    const runs = Array.from(child.childNodes).flatMap((node) => readInline(node));
    return checklist ? { children: mergeTextRuns(runs), checked: checkbox instanceof HTMLInputElement ? checkbox.checked : child.getAttribute('data-checked') === 'true' } : { children: mergeTextRuns(runs) };
  });
}

export function parseToeicNoteHtml(html: string): ToeicRichNoteDocument {
  const root = document.createElement('div');
  root.innerHTML = html;
  const blocks: ToeicRichNoteBlock[] = [];
  const appendNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? '';
      if (text.trim()) blocks.push({ type: 'paragraph', children: [{ text, marks: [] }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      const type = element.getAttribute('data-toeic-list') === 'checklist' ? 'checklist' : tag === 'ol' ? 'numbered-list' : 'bulleted-list';
      blocks.push({ type, items: readListItems(element, type === 'checklist') } as ToeicRichNoteBlock);
    } else if (tag === 'div' && Array.from(element.children).some((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase()))) {
      Array.from(element.childNodes).forEach(appendNode);
    } else {
      blocks.push({ type: 'paragraph', children: mergeTextRuns(Array.from(element.childNodes).flatMap((child) => readInline(child))) });
    }
  };
  Array.from(root.childNodes).forEach(appendNode);
  const normalized = normalizeToeicRichNoteDocument({ version: 1, blocks });
  if (!normalized) throw new Error('Ghi chú vượt quá 5000 ký tự hoặc có định dạng không hợp lệ.');
  return normalized;
}

export function getToeicNoteTextLengthFromHtml(html: string): number {
  return getToeicRichNotePlainText(parseToeicNoteHtml(html)).length;
}

function checklistForList(list: Element): void {
  list.setAttribute('data-toeic-list', 'checklist');
  Array.from(list.children).filter((child) => child.tagName.toLowerCase() === 'li').forEach((item) => {
    if (!item.querySelector('input[data-toeic-checklist-box="true"]')) item.insertAdjacentHTML('afterbegin', '<input type="checkbox" contenteditable="false" data-toeic-checklist-box="true">');
  });
}

function placeCaretIn(element: Element): void {
  const text = element.firstChild ?? element.appendChild(document.createTextNode(''));
  const range = document.createRange();
  range.selectNodeContents(text);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function toggleToeicChecklist(editor: HTMLElement): void {
  editor.focus();
  const selection = window.getSelection();
  const anchor = selection?.anchorNode instanceof Node ? selection.anchorNode : null;
  const existingList = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest('ul,ol');
  if (existingList?.getAttribute('data-toeic-list') === 'checklist') {
    existingList.removeAttribute('data-toeic-list');
    existingList.setAttribute('data-toeic-checklist-rearm', 'true');
    existingList.querySelectorAll('input[data-toeic-checklist-box="true"]').forEach((checkbox) => checkbox.remove());
    return;
  }
  if (existingList) {
    const rearm = existingList.getAttribute('data-toeic-checklist-rearm') === 'true';
    checklistForList(existingList);
    existingList.removeAttribute('data-toeic-checklist-rearm');
    const lastItem = existingList.lastElementChild;
    const lastItemIsEmpty = !lastItem?.textContent?.trim();
    if (rearm && !lastItemIsEmpty) {
      const item = document.createElement('li');
      item.innerHTML = '<input type="checkbox" contenteditable="false" data-toeic-checklist-box="true"><span><br></span>';
      existingList.appendChild(item);
      placeCaretIn(item.querySelector('span') as Element);
    } else if (rearm && lastItem) {
      const emptyItem = lastItem.querySelector('span') ?? lastItem;
      placeCaretIn(emptyItem);
    }
    return;
  }
  document.execCommand('insertUnorderedList');
  const current = window.getSelection()?.anchorNode;
  const createdList = current?.parentElement?.closest('ul,ol');
  if (createdList) checklistForList(createdList);
}

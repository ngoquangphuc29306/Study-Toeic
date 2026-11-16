// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ParsedVocabRow } from '../lib/excelUtils';
import { click, mount } from '../features/synonym-practice/components/test-utils/dom';

const excel = vi.hoisted(() => ({
  moduleLoads: 0,
  parse: vi.fn<(file: File) => Promise<ParsedVocabRow[]>>(async () => []),
  download: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
  excel.moduleLoads = 0;
  excel.parse.mockReset().mockResolvedValue([]);
  excel.download.mockReset();
  vi.doMock('../lib/excelUtils', () => {
    excel.moduleLoads += 1;
    return { parseExcelFile: excel.parse, downloadExcelTemplate: excel.download };
  });
});

afterEach(() => { vi.doUnmock('../lib/excelUtils'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('loads Excel implementation only when the learner requests the template', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { ExcelImportModal } = await import('./ExcelImportModal');
  expect(excel.moduleLoads).toBe(0);
  const dom = await mount(<ExcelImportModal
    isOpen onClose={() => {}} collections={[]} topics={[]}
    onBulkAddVocabularies={async () => {}}
    onAddTopic={async topic => ({ ...topic, id: 'topic' })}
  />);
  try {
    expect(excel.moduleLoads).toBe(0);
    const template = [...dom.container.querySelectorAll('button')].find(button => button.textContent?.includes('Tải File Mẫu'));
    expect(template).toBeTruthy();
    await click(template!);
    expect(excel.moduleLoads).toBe(1);
    expect(excel.download).toHaveBeenCalledOnce();
  } finally {
    await dom.unmount();
    vi.unstubAllGlobals();
  }
});

async function openModal() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { ExcelImportModal } = await import('./ExcelImportModal');
  const save = vi.fn(async () => {});
  const close = vi.fn();
  const dom = await mount(<ExcelImportModal
    isOpen onClose={close} collections={[]} topics={[{ id: 'topic', title: 'Vocabulary' }]}
    onBulkAddVocabularies={save}
    onAddTopic={async topic => ({ ...topic, id: 'topic' })}
  />);
  return { ...dom, save, close };
}

async function upload(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

it.each(['csv', 'xlsx'])('loads the parser on %s selection and imports only valid preview rows', async extension => {
  excel.parse.mockResolvedValue([
    { word: 'agenda', meaning: 'meeting plan', synonyms: 'schedule', isValid: true },
    { word: 'invalid', meaning: '', isValid: false },
  ]);
  const dom = await openModal();
  try {
    expect(excel.moduleLoads).toBe(0);
    const file = new File(['data'], `words.${extension}`);
    await upload(dom.container, file);
    expect(excel.moduleLoads).toBe(1);
    expect(excel.parse).toHaveBeenCalledWith(file);
    expect(dom.container.textContent).toContain('agenda');
    const submit = [...dom.container.querySelectorAll('button')].find(b => b.textContent?.includes('Import (1 Từ)'))!;
    await click(submit);
    expect(dom.save).toHaveBeenCalledWith([expect.objectContaining({
      word: 'agenda', meaning: 'meeting plan', synonyms: 'schedule', topic_id: 'topic', part_of_speech: 'noun',
    })]);
    expect(dom.close).toHaveBeenCalledOnce();
  } finally { await dom.unmount(); }
});

it.each(['empty', 'parse failure', 'module failure'])('shows the existing file error for %s and clears parsing state', async failure => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  if (failure === 'parse failure') excel.parse.mockRejectedValue(new Error('bad file'));
  if (failure === 'module failure') vi.doMock('../lib/excelUtils', () => { throw new Error('chunk unavailable'); });
  const dom = await openModal();
  try {
    await upload(dom.container, new File(['bad'], 'words.csv'));
    expect(dom.container.textContent).toContain(failure === 'empty'
      ? 'File Excel/CSV không chứa dữ liệu từ vựng hợp lệ.'
      : 'Không thể đọc file. Vui lòng đảm bảo file là định dạng Excel (.xlsx, .xls) hoặc CSV hợp lệ.');
    expect(dom.container.textContent).not.toContain('Đang đọc file');
    expect(dom.save).not.toHaveBeenCalled();
  } finally { await dom.unmount(); }
});

it('reports a failed template download in the modal', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  excel.download.mockImplementation(() => { throw new Error('download failed'); });
  const dom = await openModal();
  try {
    await click([...dom.container.querySelectorAll('button')].find(b => b.textContent?.includes('Tải File Mẫu'))!);
    expect(dom.container.textContent).toContain('Không thể tải file mẫu. Vui lòng thử lại.');
    expect(dom.close).not.toHaveBeenCalled();
  } finally { await dom.unmount(); }
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile } from './excelUtils';

describe('Excel import compatibility across on-demand loading', () => {
  it('parses CSV headers and preserves vocabulary data', async () => {
    const file = new File(['Word,Meaning,Synonyms\nagenda,meeting plan,schedule'], 'words.csv', { type: 'text/csv' });
    const rows = await parseExcelFile(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ word: 'agenda', meaning: 'meeting plan', synonyms: 'schedule', isValid: true });
  });

  it('parses XLSX data with the same field mapping', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Word', 'Meaning', 'Synonyms'],
      ['agenda', 'meeting plan', 'schedule'],
    ]), 'Vocabulary');
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const file = new File([bytes], 'words.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const rows = await parseExcelFile(file);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ word: 'agenda', meaning: 'meeting plan', synonyms: 'schedule', isValid: true });
  });
});

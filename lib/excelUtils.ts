import * as XLSX from 'xlsx';
import { Vocabulary } from './types';

export interface ParsedVocabRow {
  word: string;
  phonetic_uk?: string;
  phonetic_us?: string;
  part_of_speech?: string;
  meaning: string;
  example?: string;
  example_translation?: string;
  synonyms?: string;
  collocations?: string;
  note?: string;
  isValid: boolean;
  validationError?: string;
}

// Function to parse uploaded Excel / CSV file
export async function parseExcelFile(file: File): Promise<ParsedVocabRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Không thể đọc dữ liệu file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert worksheet to raw json array
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const results: ParsedVocabRow[] = rawJson.map((row) => {
          // Find matching values by normalized header keys
          let word = '';
          let phonetic_uk = '';
          let phonetic_us = '';
          let part_of_speech = 'noun';
          let meaning = '';
          let example = '';
          let example_translation = '';
          let synonyms = '';
          let collocations = '';
          let note = '';

          Object.keys(row).forEach((key) => {
            const val = String(row[key] || '').trim();
            const normalizedKey = key
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd')
              .replace(/[^a-z0-9]/g, '');

            if (
              normalizedKey === 'tuvung' ||
              normalizedKey === 'word' ||
              normalizedKey === 'vocabulary'
            ) {
              word = val;
            } else if (
              normalizedKey === 'ipauk' ||
              normalizedKey === 'phoneticuk' ||
              normalizedKey === 'uk'
            ) {
              phonetic_uk = val;
            } else if (
              normalizedKey === 'ipkus' ||
              normalizedKey === 'ipaus' ||
              normalizedKey === 'phoneticus' ||
              normalizedKey === 'us'
            ) {
              phonetic_us = val;
            } else if (
              normalizedKey === 'meaning' ||
              normalizedKey === 'nghia' ||
              normalizedKey === 'nghiatiengviet'
            ) {
              meaning = val;
            } else if (normalizedKey === 'example' || normalizedKey === 'vidu') {
              example = val;
            } else if (
              normalizedKey === 'examplevi' ||
              normalizedKey === 'viduvi' ||
              normalizedKey === 'dichvidu' ||
              normalizedKey === 'dichnghia'
            ) {
              example_translation = val;
            } else if (
              normalizedKey === 'tudongnghia' ||
              normalizedKey === 'dongnghia' ||
              normalizedKey === 'synonyms' ||
              normalizedKey === 'synonym'
            ) {
              synonyms = val;
            } else if (
              normalizedKey === 'cumtu' ||
              normalizedKey === 'collocations' ||
              normalizedKey === 'phrases' ||
              normalizedKey === 'phrase'
            ) {
              collocations = val;
            } else if (
              normalizedKey === 'loaitu' ||
              normalizedKey === 'partofspeech' ||
              normalizedKey === 'pos'
            ) {
              if (val) part_of_speech = val.toLowerCase();
            } else if (normalizedKey === 'ghichu' || normalizedKey === 'note') {
              note = val;
            }
          });

          const isValid = word.length > 0 && meaning.length > 0;
          let validationError: string | undefined;

          if (!word) {
            validationError = 'Thiếu từ vựng tiếng Anh';
          } else if (!meaning) {
            validationError = 'Thiếu nghĩa Tiếng Việt';
          }

          return {
            word,
            phonetic_uk: phonetic_uk || undefined,
            phonetic_us: phonetic_us || undefined,
            part_of_speech: part_of_speech || 'noun',
            meaning,
            example: example || undefined,
            example_translation: example_translation || undefined,
            synonyms: synonyms || undefined,
            collocations: collocations || undefined,
            note: note || undefined,
            isValid,
            validationError,
          };
        });

        resolve(results.filter((r) => r.word || r.meaning)); // Filter out blank empty rows
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

// Function to generate and download sample Excel Template
export function downloadExcelTemplate(): void {
  const headers = [
    'Từ vựng',
    'IPA-UK',
    'IPA-US',
    'Meaning',
    'example',
    'example_vi',
    'từ đồng nghĩa',
    'cụm từ',
    'Loại từ',
  ];

  const sampleData = [
    {
      'Từ vựng': 'Obligation',
      'IPA-UK': '/ˌɒb.lɪˈɡeɪ.ʃən/',
      'IPA-US': '/ˌɑː.bləˈɡeɪ.ʃən/',
      'Meaning': 'Nghĩa vụ, bổn phận, trách nhiệm bắt buộc',
      example: 'The vendor has a legal obligation to deliver the goods on schedule.',
      example_vi: 'Bên bán có nghĩa vụ pháp lý phải giao hàng đúng tiến độ.',
      'từ đồng nghĩa': 'duty, responsibility, commitment, requirement',
      'cụm từ': 'fulfill an obligation, meet obligations, legal obligation',
      'Loại từ': 'noun',
    },
    {
      'Từ vựng': 'Implement',
      'IPA-UK': '/ˈɪm.plɪ.ment/',
      'IPK-US': '/ˈɪm.plə.ment/',
      'Meaning': 'Thi hành, thực hiện, triển khai (kế hoạch, chính sách)',
      example: 'The company plans to implement a new remote work policy next month.',
      example_vi: 'Công ty dự định triển khai chính sách làm việc từ xa mới vào tháng tới.',
      'từ đồng nghĩa': 'execute, apply, carry out, enforce',
      'cụm từ': 'implement a strategy, implement a project',
      'Loại từ': 'verb',
    },
    {
      'Từ vựng': 'Colleague',
      'IPA-UK': '/ˈkɒl.iːɡ/',
      'IPK-US': '/ˈkɑː.liːɡ/',
      'Meaning': 'Đồng nghiệp cùng cơ quan hoặc ngành nghề',
      example: 'She received warm congratulations from her colleagues on her promotion.',
      example_vi: 'Cô ấy đã nhận được những lời chúc mừng ấm áp từ đồng nghiệp khi được thăng chức.',
      'từ đồng nghĩa': 'coworker, associate, teammate',
      'cụm từ': 'trusted colleague, work colleagues',
      'Loại từ': 'noun',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });

  // Set column widths for better visual readability
  worksheet['!cols'] = [
    { wch: 18 }, // Từ vựng
    { wch: 16 }, // IPA-UK
    { wch: 16 }, // IPK-US
    { wch: 35 }, // Meaning
    { wch: 45 }, // example
    { wch: 45 }, // example_vi
    { wch: 30 }, // từ đồng nghĩa
    { wch: 35 }, // cụm từ
    { wch: 12 }, // Loại từ
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'VocabTemplate');

  XLSX.writeFile(workbook, 'VocabTOEIC_Mau_Import_Tu_Vung.xlsx');
}

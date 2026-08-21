import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyLocalMediaDirectory } from './mediaVerification';

describe('local TOEIC media verification', () => {
  it('reports missing, extra, duplicate basename and zero-size files', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'toeic-media-'));
    try {
      await mkdir(path.join(directory, '2026/t1'), { recursive: true });
      await mkdir(path.join(directory, 'backup'), { recursive: true });
      await writeFile(path.join(directory, '2026/t1/1.mp3'), 'audio');
      await writeFile(path.join(directory, 'backup/1.mp3'), 'duplicate');
      await writeFile(path.join(directory, '2026/t1/empty.webp'), '');

      const result = await verifyLocalMediaDirectory([
        {
          path: '2026/t1/1.mp3',
          kind: 'audio',
          extension: '.mp3',
          usedByQuestionNumbers: [1],
          passageId: null,
        },
        {
          path: '2026/t1/missing.webp',
          kind: 'image',
          extension: '.webp',
          usedByQuestionNumbers: [1],
          passageId: null,
        },
      ], directory, true);

      expect(result.summary.missing).toEqual(['2026/t1/missing.webp']);
      expect(result.summary.extra).toEqual(['2026/t1/empty.webp', 'backup/1.mp3']);
      expect(result.summary.duplicateBasenames).toEqual(['1.mp3']);
      expect(result.summary.zeroSize).toEqual(['2026/t1/empty.webp']);
      expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
        'missing_media_file',
        'duplicate_media_basename',
        'zero_size_media_file',
      ]));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

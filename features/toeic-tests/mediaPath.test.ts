import {
  buildToeicMediaPath,
  extractStorageFilename,
  joinStoragePath,
  resolveToeicPublicMediaUrl,
} from './mediaPath';

describe('TOEIC media path helpers', () => {
  it('extracts a filename from a legacy Supabase public URL', () => {
    expect(
      extractStorageFilename(
        'https://project.supabase.co/storage/v1/object/public/mock-test-media/2026/t1/32-34.mp3'
      )
    ).toBe('32-34.mp3');
  });

  it('extracts a filename from an ordinary URL and a relative path', () => {
    expect(extractStorageFilename('https://cdn.example.com/media/95-97.webp?cache=1')).toBe('95-97.webp');
    expect(extractStorageFilename('2026/t1/1.mp3')).toBe('1.mp3');
    expect(extractStorageFilename('/2026/t1/1.mp3#fragment')).toBe('1.mp3');
  });

  it('preserves relative nested paths and avoids duplicating media folders', () => {
    expect(buildToeicMediaPath('2026/t1', 'transcripts/32-34.txt')).toBe('2026/t1/transcripts/32-34.txt');
    expect(buildToeicMediaPath('2026/t1', '2026/t1/32-34.mp3')).toBe('2026/t1/32-34.mp3');
    expect(
      buildToeicMediaPath(
        '2026/t1',
        'https://project.supabase.co/storage/v1/object/public/mock-test-media/2026/t1/32-34.mp3'
      )
    ).toBe('2026/t1/32-34.mp3');
  });

  it('joins paths and normalizes slash boundaries', () => {
    expect(joinStoragePath('/2026/', '/t1/', '/1.mp3/')).toBe('2026/t1/1.mp3');
    expect(joinStoragePath('', null, '2026/t1')).toBe('2026/t1');
  });

  it('decodes then safely re-encodes media names in the public URL', () => {
    expect(
      resolveToeicPublicMediaUrl({
        supabaseUrl: 'https://new-project.supabase.co/',
        bucket: 'toeic-test-media',
        mediaFolder: '2026/t1',
        source: 'audio/32%2D34 practice.mp3',
      })
    ).toBe(
      'https://new-project.supabase.co/storage/v1/object/public/toeic-test-media/2026/t1/audio/32-34%20practice.mp3'
    );
  });

  it('returns null for missing or unsafe inputs', () => {
    expect(extractStorageFilename(null)).toBeNull();
    expect(extractStorageFilename('')).toBeNull();
    expect(buildToeicMediaPath('2026/t1', '../secret.mp3')).toBeNull();
    expect(buildToeicMediaPath('2026/t1', 'https://cdn.example.com/secret.mp3')).toBeNull();
    expect(
      resolveToeicPublicMediaUrl({
        supabaseUrl: 'https://project.supabase.co',
        bucket: 'toeic-test-media',
        mediaFolder: '2026/t1',
        source: null,
      })
    ).toBeNull();
  });
});

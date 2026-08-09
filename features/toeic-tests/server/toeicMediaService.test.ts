import { describe, expect, it, vi } from 'vitest';
import { createToeicMediaSigningService, type ToeicMediaSigningDependencies } from './toeicMediaService';

// The production module is intentionally protected by `server-only`; this
// unit test injects all dependencies and does not execute the server boundary.
vi.mock('server-only', () => ({}));

const testId = 'ad780150-f675-42b9-8ced-246862b0d0a8';

function createDependencies(overrides: Partial<ToeicMediaSigningDependencies> = {}): ToeicMediaSigningDependencies {
  return {
    getTest: async () => ({ id: testId, status: 'published', media_folder: '2026/set-1' }),
    getReferencedPaths: async () => new Set(['2026/set-1/audio.mp3']),
    createSignedUrls: async (paths) => paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })),
    ...overrides,
  };
}

describe('TOEIC server-only media signing service', () => {
  it('signs only published, referenced paths and deduplicates requests', async () => {
    const result = await createToeicMediaSigningService(createDependencies()).sign({
      userId: 'user-1',
      testId,
      paths: ['audio.mp3', 'audio.mp3'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('2026/set-1/audio.mp3');
    expect(result[0].signedUrl).toContain('signed');
  });

  it('rejects unreferenced media instead of signing an arbitrary object', async () => {
    const service = createToeicMediaSigningService(createDependencies());
    await expect(service.sign({ userId: 'user-1', testId, paths: ['secret.mp3'] }))
      .rejects.toMatchObject({ code: 'MEDIA_NOT_FOUND' });
  });

  it('rejects unpublished tests and path traversal', async () => {
    const unpublished = createToeicMediaSigningService(createDependencies({
      getTest: async () => ({ id: testId, status: 'draft', media_folder: '2026/set-1' }),
    }));
    await expect(unpublished.sign({ userId: 'user-1', testId, paths: ['audio.mp3'] }))
      .rejects.toMatchObject({ code: 'TEST_NOT_PUBLISHED' });

    const service = createToeicMediaSigningService(createDependencies());
    await expect(service.sign({ userId: 'user-1', testId, paths: ['../audio.mp3'] }))
      .rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('does not treat signing failures as successful URLs', async () => {
    const service = createToeicMediaSigningService(createDependencies({
      createSignedUrls: async (paths) => paths.map((path) => ({ path, signedUrl: null, error: new Error('missing') })),
    }));
    await expect(service.sign({ userId: 'user-1', testId, paths: ['audio.mp3'] }))
      .rejects.toMatchObject({ code: 'MEDIA_SIGNING_FAILED' });
  });

  it('returns an allowlisted external URL without calling storage signing', async () => {
    const externalUrl = 'https://media.example.com/test-1/audio.mp3?token=secret';
    const createSignedUrls = vi.fn(async (paths: ReadonlyArray<string>) => paths.map((path) => ({ path, signedUrl: `https://signed/${path}`, error: null })));
    const service = createToeicMediaSigningService(
      createDependencies({
        getReferencedPaths: async () => new Set([`external_url:${externalUrl}`]),
        createSignedUrls,
      }),
      { allowedExternalMediaHosts: new Set(['media.example.com']) },
    );

    const result = await service.sign({ userId: 'user-1', testId, paths: [externalUrl] });

    expect(result[0]).toMatchObject({ path: externalUrl, signedUrl: externalUrl, sourceType: 'external_url' });
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it('rejects legacy Markdown at the runtime boundary', async () => {
    const value = 'https://media.example.com/test-1/audio.mp3';
    const service = createToeicMediaSigningService(createDependencies({
      getReferencedPaths: async () => new Set([`external_url:${value}`]),
    }), { allowedExternalMediaHosts: new Set(['media.example.com']) });

    await expect(service.sign({
      userId: 'user-1',
      testId,
      paths: [`[${value}](${value})`],
    })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an external host that is not allowlisted', async () => {
    const service = createToeicMediaSigningService(createDependencies(), {
      allowedExternalMediaHosts: new Set(['other.example.com']),
    });
    await expect(service.sign({
      userId: 'user-1',
      testId,
      paths: ['https://media.example.com/test-1/audio.mp3'],
    })).rejects.toMatchObject({ code: 'MEDIA_HOST_NOT_ALLOWED' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  isAllowedToeicExternalMediaUrl,
  normalizeToeicMediaReference,
  parseToeicExternalMediaHosts,
  parseToeicMediaSource,
  ToeicMediaSourceError,
  validateToeicMediaSource,
} from './mediaSource';

const allowedHosts = parseToeicExternalMediaHosts('media.example.com,old-project.supabase.co');

describe('TOEIC media source classification', () => {
  it('classifies relative storage paths', () => {
    expect(parseToeicMediaSource('2026/test-1/audio.mp3')).toEqual({
      type: 'storage_path',
      value: '2026/test-1/audio.mp3',
    });
  });

  it('preserves an HTTPS URL and its query string', () => {
    expect(parseToeicMediaSource('"https://media.example.com/Audio/Track.MP3?token=abc"')).toEqual({
      type: 'external_url',
      value: 'https://media.example.com/Audio/Track.MP3?token=abc',
    });
  });

  it('normalizes the exact legacy [URL](URL) representation and preserves the query string', () => {
    const value = 'https://media.example.com/Audio/Track.MP3?token=abc&v=2';
    expect(normalizeToeicMediaReference(`[${value}](${value})`)).toBe(value);
    expect(validateToeicMediaSource(`[${value}](${value})`, allowedHosts)).toEqual({
      type: 'external_url',
      value,
    });
  });

  it('preserves plain HTTPS and relative storage values at the normalization boundary', () => {
    expect(normalizeToeicMediaReference('https://media.example.com/audio.mp3')).toBe('https://media.example.com/audio.mp3');
    expect(normalizeToeicMediaReference('2026/t1/audio.mp3')).toBe('2026/t1/audio.mp3');
  });

  it.each([
    '[Audio](https://media.example.com/audio.mp3)',
    '[https://media.example.com/a.mp3](https://media.example.com/b.mp3)',
    '[https://media.example.com/audio.mp3](https://media.example.com/audio.mp3',
  ])('rejects ambiguous Markdown media value %s', (value) => {
    expect(() => normalizeToeicMediaReference(value)).toThrow(ToeicMediaSourceError);
    expect(() => validateToeicMediaSource(value, allowedHosts)).toThrow(/Markdown/);
  });

  it.each(['http://media.example.com/audio.mp3', 'ftp://media.example.com/audio.mp3', 'javascript:alert(1)', 'data:audio/mp3;base64,abc'])('rejects unsafe scheme %s', (value) => {
    expect(parseToeicMediaSource(value)).toBeNull();
    expect(() => validateToeicMediaSource(value, allowedHosts)).toThrow();
  });

  it.each(['https://user:password@media.example.com/audio.mp3', 'https://localhost/audio.mp3', 'https://127.0.0.1/audio.mp3', 'https://192.168.1.5/audio.mp3', 'https://media.example.com:8443/audio.mp3'])('rejects unsafe HTTPS URL %s', (value) => {
    expect(parseToeicMediaSource(value)).toBeNull();
  });

  it('requires an exact allowlisted host', () => {
    const url = new URL('https://media.example.com/audio.mp3');
    expect(isAllowedToeicExternalMediaUrl(url, allowedHosts)).toBe(true);
    expect(isAllowedToeicExternalMediaUrl(new URL('https://sub.media.example.com/audio.mp3'), allowedHosts)).toBe(false);
    expect(() => validateToeicMediaSource(url.href, new Set(['other.example.com']))).toThrow(/allowlisted/);
  });
});

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ImportValidationIssue, MediaVerificationSummary, ToeicMediaManifestEntry } from './types.ts';

async function listFiles(directory: string, prefix = ''): Promise<Array<{ relativePath: string; size: number }>> {
  const entries = await readdir(path.join(directory, prefix), { withFileTypes: true });
  const files: Array<{ relativePath: string; size: number }> = [];

  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, relativePath));
      continue;
    }
    if (entry.isFile()) {
      const fileStat = await stat(path.join(directory, relativePath));
      files.push({ relativePath: relativePath.split(path.sep).join('/'), size: fileStat.size });
    }
  }

  return files;
}

export async function verifyLocalMediaDirectory(
  manifest: ToeicMediaManifestEntry[],
  directory: string,
  strictMissing: boolean
): Promise<{ summary: MediaVerificationSummary; issues: ImportValidationIssue[] }> {
  const files = await listFiles(directory);
  const expected = manifest.map((entry) => entry.path).sort();
  const found = files.map((file) => file.relativePath).sort();
  const expectedSet = new Set(expected);
  const foundSet = new Set(found);
  const missing = expected.filter((file) => !foundSet.has(file));
  const extra = found.filter((file) => !expectedSet.has(file));
  const basenameMap = new Map<string, string[]>();
  for (const file of found) {
    const basename = path.posix.basename(file);
    const list = basenameMap.get(basename) ?? [];
    list.push(file);
    basenameMap.set(basename, list);
  }
  const duplicateBasenames = [...basenameMap.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([basename]) => basename)
    .sort();
  const zeroSize = files.filter((file) => file.size === 0).map((file) => file.relativePath).sort();
  const issues: ImportValidationIssue[] = [];

  for (const file of missing) {
    issues.push({
      severity: strictMissing ? 'error' : 'warning',
      code: 'missing_media_file',
      path: file,
      message: `Expected media file was not found under ${directory}.`,
    });
  }
  if (extra.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'extra_media_file',
      path: directory,
      message: `${extra.length} extra media file(s) were found.`,
    });
  }
  for (const basename of duplicateBasenames) {
    issues.push({
      severity: 'warning',
      code: 'duplicate_media_basename',
      path: basename,
      message: 'The basename occurs in more than one directory.',
    });
  }
  for (const file of zeroSize) {
    issues.push({
      severity: 'error',
      code: 'zero_size_media_file',
      path: file,
      message: 'Media file has zero bytes.',
    });
  }

  return {
    summary: { expected, found, missing, extra, duplicateBasenames, zeroSize },
    issues,
  };
}

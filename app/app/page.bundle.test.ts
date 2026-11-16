import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

// Run explicitly after npm run build: PHASE_B_BUNDLE_CHECK=1 npx vitest run app/app/page.bundle.test.ts
it.skipIf(process.env.PHASE_B_BUNDLE_CHECK !== '1')('keeps SheetJS outside the initial /app manifest', () => {
  const manifest = JSON.parse(readFileSync('.next/app-build-manifest.json', 'utf8')) as { pages: Record<string, string[]> };
  const initial = [...new Set(manifest.pages['/app/page'])];
  expect(manifest.pages['/app/page']).toBeDefined();
  const bytes = initial.map(file => readFileSync(join('.next', file)));
  console.info('Initial /app manifest:', JSON.stringify({
    chunks: initial.length,
    raw: bytes.reduce((sum, file) => sum + file.length, 0),
    gzip: bytes.reduce((sum, file) => sum + gzipSync(file).length, 0),
  }));
  const sheetChunks = readdirSync('.next/static/chunks').filter(file => file.endsWith('.js') && readFileSync(join('.next/static/chunks', file), 'utf8').includes('SheetJS'));
  console.info('SheetJS chunks:', sheetChunks);
  expect(sheetChunks.length).toBeGreaterThan(0);
  expect(initial.filter((_, index) => bytes[index].includes('SheetJS'))).toEqual([]);
  const layouts = ['/layout', '/app/layout'].flatMap(route => manifest.pages[route] ?? []);
  expect(layouts.filter(file => readFileSync(join('.next', file)).includes('SheetJS'))).toEqual([]);
});

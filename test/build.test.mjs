import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('buildSite tidak menghapus ikon lama', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-build-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  mkdirSync(join(outDir, 'icons'), { recursive: true });
  writeFileSync(join(outDir, 'icons', 'keep.webp'), 'fake-webp');
  writeFileSync(dataPath, JSON.stringify({ apps: [{ slug: 'morphe-youtube', name: 'Morphe YouTube', version: '21.30.216', updated: '2026-11-04', category: 'Video Players & Editors', size_mb: 140.58, android_min: '9.0', arch: 'Universal', root: false, patch_bundle: '2.0.0', description: 'Test', description_html: null, icon: '/icons/morphe-youtube.webp', download_url: 'https://gitlab.com/x.apk', popular: true, source_url: 'https://morpheapk.com/morphe-youtube/', scraped_at: '2026-11-21T00:00:00Z' }], generated_at: '2026-11-21T00:00:00Z' }));
  const r = await buildSite({ dataPath, outDir });
  assert.equal(r.count, 1);
  assert.ok(existsSync(join(outDir, 'icons', 'keep.webp')));
  assert.ok(existsSync(join(outDir, 'index.html')));
  assert.ok(existsSync(join(outDir, 'apps', 'morphe-youtube', 'index.html')));
  const detail = readFileSync(join(outDir, 'apps', 'morphe-youtube', 'index.html'), 'utf8');
  assert.ok(detail.includes('4 Nov 2026'));
  assert.ok(detail.includes('target="_blank"'));
});

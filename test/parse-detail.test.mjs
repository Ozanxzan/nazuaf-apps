import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAppDetail } from '../scripts/lib/parse-detail.mjs';

const html = readFileSync(new URL('./fixtures/detail-youtube.html', import.meta.url), 'utf8');

test('parseAppDetail YouTube lengkap', () => {
  const d = parseAppDetail(html, 'https://morpheapk.com/morphe-youtube/');
  assert.equal(d.version, '21.30.216');
  assert.equal(d.size_mb, 140.58);
  assert.equal(d.updated, '2026-11-04');
  assert.equal(d.root, false);
  assert.equal(d.arch, 'Universal');
  assert.equal(d.category, 'Video Players & Editors');
  assert.equal(d.patch_bundle, '2.0.0');
  assert.match(d.download_url, /^https:\/\/gitlab\.com\/api\/v4\/projects\/87288318/);
  assert.equal(d.icon, '/icons/morphe-youtube.webp');
  assert.equal(d.icon_src, '/img/apps/youtube-morphe.webp');
  assert.ok(d.description_html && d.description_html.includes('What is Morphe YouTube?'));
});

test('parseAppDetail tanpa JSON-LD tetap lolos dari tabel', () => {
  const stripped = html.replace(/<script type=application\/ld\+json>.*?<\/script>/gs, '');
  const d = parseAppDetail(stripped, 'https://morpheapk.com/morphe-youtube/');
  assert.equal(d.version, '21.30.216');
  assert.equal(d.updated, '2026-11-04');
  assert.match(d.download_url, /gitlab\.com/);
});

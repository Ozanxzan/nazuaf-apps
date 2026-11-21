import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAppList } from '../scripts/lib/parse-list.mjs';

const html = readFileSync(new URL('./fixtures/apps-list.html', import.meta.url), 'utf8');

test('parseAppList ambil 100 URL dari JSON-LD', () => {
  const r = parseAppList(html);
  assert.equal(r.urls.length, 100);
  assert.ok(r.urls.every((u) => u.startsWith('https://morpheapk.com/morphe-')));
  assert.equal(r.cards['morphe-youtube'].iconSrc, '/img/apps/youtube-morphe.webp');
  assert.equal(r.cards['morphe-aiocal'].category, 'Tools');
  assert.ok(r.popularSlugs.includes('morphe-youtube'));
  assert.equal(r.popularSlugs.length, 8);
});

test('parseAppList fallback tanpa JSON-LD', () => {
  const stripped = html.replace(/<script type=application\/ld\+json>.*?<\/script>/gs, '');
  const r = parseAppList(stripped);
  assert.ok(r.urls.length >= 90, `urls=${r.urls.length}`);
});

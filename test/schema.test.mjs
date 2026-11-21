import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApp, parseSizeMb, parseDateId, parseRoot, slugFromUrl, writeAppsJson, hashContent } from '../scripts/lib/schema.mjs';

test('normalizeApp mengisi null untuk field hilang', () => {
  assert.equal(normalizeApp({ slug: 'x' }).version, null);
  assert.equal(normalizeApp({ slug: 'x' }).name, null);
});

test('parseSizeMb', () => {
  assert.equal(parseSizeMb('140.58 MB'), 140.58);
  assert.equal(parseSizeMb('1,2 GB'), 1228.8);
  assert.equal(parseSizeMb(null), null);
});

test('parseDateId', () => {
  assert.equal(parseDateId('04 Nov 2026'), '2026-11-04');
  assert.equal(parseDateId('November 4, 2026'), '2026-11-04');
  assert.equal(parseDateId('2026-11-04T14:01:36+00:00'), '2026-11-04');
});

test('parseRoot', () => {
  assert.equal(parseRoot('Not needed'), false);
  assert.equal(parseRoot('Required'), true);
  assert.equal(parseRoot('apa ini'), null);
});

test('slugFromUrl', () => {
  assert.equal(slugFromUrl('https://morpheapk.com/morphe-youtube/'), 'morphe-youtube');
  assert.equal(slugFromUrl('https://morpheapk.com/morphe-youtube'), 'morphe-youtube');
  assert.equal(slugFromUrl('https://morpheapk.com/morphe-youtube/?x=1'), 'morphe-youtube');
});

test('hashContent mengabaikan scraped_at', () => {
  const a = [{ slug: 'x', version: '1', scraped_at: '2026-01-01T00:00:00Z' }];
  const b = [{ slug: 'x', version: '1', scraped_at: '2026-02-02T00:00:00Z' }];
  assert.equal(hashContent(a), hashContent(b));
  const c = [{ slug: 'x', version: '2', scraped_at: '2026-01-01T00:00:00Z' }];
  assert.notEqual(hashContent(a), hashContent(c));
});

test('writeAppsJson round-trip', () => {
  const s = writeAppsJson([{ slug: 'x' }], '2026-11-21T00:00:00Z');
  assert.equal(JSON.parse(s).generated_at, '2026-11-21T00:00:00Z');
});

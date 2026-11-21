import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApp } from '../scripts/lib/validate.mjs';

const base = { slug: 'morphe-youtube', name: 'Morphe YouTube', version: '21.30.216', download_url: 'https://gitlab.com/api/v4/projects/87288318/packages/generic/morphe-apks/latest/youtube-universal-morphe-v21.30.216.apk' };

test('validateApp tolak download_url kosong', () => {
  assert.equal(validateApp({ ...base, download_url: null }).ok, false);
});

test('host non-gitlab lolos dengan warn', () => {
  const r = validateApp({ ...base, download_url: 'https://example.com/x.apk' });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.length >= 1);
});

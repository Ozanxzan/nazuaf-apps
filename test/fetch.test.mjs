import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchHtml } from '../scripts/lib/fetch.mjs';

test('fetchHtml retry 3x lalu throw', async () => {
  let calls = 0;
  const stub = async () => { calls++; throw new Error('boom'); };
  await assert.rejects(
    fetchHtml('https://x', { retries: 3, backoffMs: 1, fetchFn: stub }),
    /fetch failed after 4/,
  );
  assert.equal(calls, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runScrape } from '../scripts/scrape.mjs';

test('runScrape skip aplikasi rusak, lanjut', async () => {
  const listHtml = readFileSync(new URL('./fixtures/apps-list.html', import.meta.url), 'utf8');
  const detailHtml = readFileSync(new URL('./fixtures/detail-youtube.html', import.meta.url), 'utf8');
  // Batasi ke 2 URL pertama dengan stub fetch: pertama OK, kedua kosong
  const urls = ['https://morpheapk.com/morphe-aiocal/', 'https://morpheapk.com/morphe-youtube/'];
  let i = 0;
  const fetchStub = async (url) => {
    if (url === 'https://morpheapk.com/apps/') return listHtml;
    // Paksa parseAppList hanya melihat 2 URL dengan memotong list? Sederhananya: kembalikan detail OK untuk aiocal, kosong untuk youtube
    i++;
    if (url.includes('aiocal')) return detailHtml.replaceAll('morphe-youtube', 'morphe-aiocal').replaceAll('Morphe YouTube', 'Morphe Aiocal');
    return '';
  };
  // runScrape memakai URL dari daftar (100) — test ini hanya memastikan fungsi tidak crash pada detail kosong
  // dan mengembalikan skipped > 0. Kami tidak assert jumlah pasti karena daftar penuh.
  const r = await runScrape({ fetchHtml: fetchStub, downloadIcon: async () => {}, delayMs: 0 });
  assert.ok(r.apps.length >= 0);
  assert.ok(r.skipped >= 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapMirrors } from '../scripts/map-mirrors.mjs';
import { loadMirrors, applyMirrors } from '../scripts/lib/mirror.mjs';
import { renderDetail } from '../scripts/lib/render.mjs';
import { buildSite } from '../scripts/build.mjs';

const apps = [
  { slug: 'morphe-youtube', version: '21.30.216' },
  { slug: 'morphe-instagram', version: '447.0.0.55.81' },
  { slug: 'morphe-ibs-paint', version: '14.0.6' },
  { slug: 'morphe-gboard', version: '18.0.3.954559732-release-arm64-v8a' },
  { slug: 'morphe-tiktok', version: '46.2.3' },
];

const forkAssets = {
  'Purple-Drain': [
    { key: 'youtube', arch: 'universal', version: '21.30.216', name: 'youtube-universal-morphe-v21.30.216.apk', url: 'https://github.com/Purple-Drain/x/youtube-universal-morphe-v21.30.216.apk' },
    { key: 'instagram', arch: 'arm64-v8a', version: '452.1.0.53.64', name: 'instagram-arm64-v8a-piko-patches-v452.1.0.53.64.apk', url: 'https://github.com/Purple-Drain/x/ig452.apk' },
    { key: 'gboard', arch: 'universal', version: '18.5.4.993608717-release-arm64-v8a', name: 'gboard-universal-morphe-patches-v18.5.4.993608717-release-arm64-v8a.apk', url: 'https://github.com/Purple-Drain/x/gboard.apk' },
  ],
  Macka323: [
    { key: 'instagram', arch: 'arm64-v8a', version: '447.0.0.55.81', name: 'instagram-arm64-v8a-piko-patches-v447.0.0.55.81.apk', url: 'https://github.com/Macka323/x/ig447.apk' },
    { key: 'ibs-paint', arch: 'universal', version: '14.0.6', name: 'ibs_paint-universal-morphe-patches-v14.0.6.apk', url: 'https://github.com/Macka323/x/ibs.apk' },
    { key: 'tiktok', arch: 'universal', version: '46.2.3', name: 'tiktok-universal-morphe-patches-v46.2.3.apk', url: 'https://github.com/Macka323/x/tiktok.apk' },
  ],
  rpeters1430: [],
  toidicakhia: [],
};

test('mapMirrors: versi sama persis diutamakan, urutan fork jadi penentu', () => {
  const { mirrors, report } = mapMirrors(apps, forkAssets);
  // YouTube: exact di Purple-Drain (utama) → Purple-Drain.
  assert.equal(mirrors['morphe-youtube'].source, 'Purple-Drain');
  assert.equal(mirrors['morphe-youtube'].exact, true);
  // Instagram: Purple-Drain hanya punya 452, Macka323 punya 447 yang sama persis → Macka323.
  assert.equal(mirrors['morphe-instagram'].source, 'Macka323');
  assert.equal(mirrors['morphe-instagram'].version, '447.0.0.55.81');
  assert.equal(mirrors['morphe-instagram'].exact, true);
  // TikTok: hanya Macka323 yang punya versi sama persis.
  assert.equal(mirrors['morphe-tiktok'].source, 'Macka323');
  assert.equal(report.covered, 5);
  assert.equal(report.exact, 4);
});

test('mapMirrors: underscore di nama file dinormalisasi, versi berisi -arm64-v8a ikut terurai', () => {
  const { mirrors } = mapMirrors(apps, forkAssets);
  // ibs_paint (underscore) cocok ke slug morphe-ibs-paint.
  assert.equal(mirrors['morphe-ibs-paint'].url, 'https://github.com/Macka323/x/ibs.apk');
  // Gboard: tidak ada yang sama persis → versi terbaru (18.5.4...) utuh, bukan "8a".
  assert.equal(mirrors['morphe-gboard'].version, '18.5.4.993608717-release-arm64-v8a');
  assert.equal(mirrors['morphe-gboard'].exact, false);
});

test('mapMirrors: aplikasi tanpa mirror masuk unmatched', () => {
  const { mirrors, report } = mapMirrors([{ slug: 'morphe-tidak-ada', version: '1.0' }], forkAssets);
  assert.equal(mirrors['morphe-tidak-ada'], undefined);
  assert.deepEqual(report.unmatched, ['morphe-tidak-ada']);
});

test('renderDetail memakai URL mirror + catatan uninstall, versi mirror ditampilkan kalau beda', () => {
  const app = {
    slug: 'morphe-instagram', name: 'Morphe Instagram', version: '447.0.0.55.81',
    updated: '2026-11-04', category: 'Social', size_mb: 150, android_min: '9.0',
    arch: 'arm64-v8a', root: false, patch_bundle: '3.11.1', description: 'Test',
    description_html: null, icon: '/icons/morphe-instagram.webp',
    download_url: 'https://gitlab.com/api/v4/projects/87288318/packages/generic/morphe-apks/latest/x.apk',
    source_url: 'https://morpheapk.com/morphe-instagram/',
    download_mirror_url: 'https://github.com/Macka323/Morphe-AutoBuilds/releases/download/latest/instagram-arm64-v8a-piko-patches-v447.0.0.55.81.apk',
    mirror_source: 'Macka323', mirror_version: '447.0.0.55.81', mirror_exact: true,
  };
  const html = renderDetail(app);
  assert.ok(html.includes('github.com/Macka323/Morphe-AutoBuilds/releases/download/latest/instagram-arm64-v8a-piko-patches-v447.0.0.55.81.apk'));
  assert.ok(!html.includes('gitlab.com/api/v4/projects/87288318'));
  assert.ok(html.includes('hapus instalasi lama'));
  assert.ok(html.includes('Macka323'));
  // Versi sama persis → tidak ada keterangan versi mirror tambahan.
  assert.ok(!html.includes('file yang diunduh adalah'));

  const newer = { ...app, mirror_version: '452.1.0.53.64', mirror_exact: false };
  const html2 = renderDetail(newer);
  assert.ok(html2.includes('file yang diunduh adalah v452.1.0.53.64'));
});

test('renderDetail tanpa mirror tetap pakai download_url GitLab', () => {
  const app = {
    slug: 'morphe-youtube', name: 'Morphe YouTube', version: '21.30.216',
    updated: '2026-11-04', category: 'Video', size_mb: 140, android_min: '9.0',
    arch: 'Universal', root: false, patch_bundle: '2.0.0', description: 'Test',
    description_html: null, icon: '/icons/morphe-youtube.webp',
    download_url: 'https://gitlab.com/api/v4/projects/87288318/packages/generic/morphe-apks/latest/y.apk',
    source_url: 'https://morpheapk.com/morphe-youtube/',
  };
  const html = renderDetail(app);
  assert.ok(html.includes('gitlab.com/api/v4/projects/87288318'));
  assert.ok(!html.includes('hapus instalasi lama'));
});

test('buildSite menggabung mirror-urls.json di samping apps.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-mirror-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  writeFileSync(dataPath, JSON.stringify({
    apps: [{ slug: 'morphe-youtube', name: 'Morphe YouTube', version: '21.30.216', updated: '2026-11-04', category: 'Video', size_mb: 140, android_min: '9.0', arch: 'Universal', root: false, patch_bundle: '2.0.0', description: 'Test', description_html: null, icon: '/icons/morphe-youtube.webp', download_url: 'https://gitlab.com/x.apk', popular: true, source_url: 'https://morpheapk.com/morphe-youtube/', scraped_at: '2026-11-21T00:00:00Z' }],
    generated_at: '2026-11-21T00:00:00Z',
  }));
  writeFileSync(join(dir, 'mirror-urls.json'), JSON.stringify({
    mirrors: { 'morphe-youtube': { url: 'https://github.com/Purple-Drain/x/y.apk', source: 'Purple-Drain', version: '21.30.216', arch: 'universal', exact: true } },
  }));
  const r = await buildSite({ dataPath, outDir });
  assert.equal(r.count, 1);
  const detail = readFileSync(join(outDir, 'apps', 'morphe-youtube', 'index.html'), 'utf8');
  assert.ok(detail.includes('github.com/Purple-Drain/x/y.apk'));
  assert.ok(detail.includes('hapus instalasi lama'));
});

test('loadMirrors/applyMirrors tahan kalau file tidak ada', () => {
  assert.deepEqual(loadMirrors('/tmp/tidak-ada-mirror-urls.json'), {});
  const apps2 = applyMirrors([{ slug: 'morphe-youtube' }], {});
  assert.deepEqual(apps2, [{ slug: 'morphe-youtube' }]);
});

// --- refresh live dari GitHub API ---

import { fetchForkAssets, refreshMirrors } from '../scripts/map-mirrors.mjs';

function stubFetchFactory(assetNamesByFork = {}) {
  const calls = [];
  const stub = async (url) => {
    calls.push(url);
    const m = url.match(/repos\/([^/]+)\/Morphe-AutoBuilds\/releases\/tags\/latest/);
    if (m) return { ok: true, json: async () => ({ id: 999 }) };
    const a = url.match(/repos\/([^/]+)\/Morphe-AutoBuilds\/releases\/999\/assets\?per_page=100&page=(\d+)/);
    if (a) {
      const page = Number(a[2]);
      const names = page === 1 ? (assetNamesByFork[a[1]] || []) : [];
      return { ok: true, json: async () => names.map((n) => ({ name: n, browser_download_url: `https://github.com/${a[1]}/x/${n}` })) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  stub.calls = calls;
  return stub;
}

const LIVE_ASSETS = {
  'Purple-Drain': [
    'youtube-universal-morphe-v21.30.216.apk',
    'instagram-arm64-v8a-piko-patches-v452.1.0.53.64.apk',
    'instagram-arm64-v8a-piko-patches-v452.1.0.53.64.apk.sha256',
  ],
  Macka323: ['instagram-arm64-v8a-piko-patches-v447.0.0.55.81.apk'],
};

test('fetchForkAssets ambil rilis latest + paginasi aset, .sha256 dibuang', async () => {
  const stub = stubFetchFactory(LIVE_ASSETS);
  const out = await fetchForkAssets(stub);
  assert.equal(out['Purple-Drain'].length, 2);
  assert.equal(out['Purple-Drain'][0].key, 'youtube');
  assert.equal(out.Macka323.length, 1);
  assert.equal(out.Macka323[0].version, '447.0.0.55.81');
  assert.ok(stub.calls.some((u) => u.includes('/releases/tags/latest')));
  assert.ok(stub.calls.some((u) => u.includes('/releases/999/assets?per_page=100&page=1')));
});

test('refreshMirrors tulis file + hitung URL berubah', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-refresh-'));
  const outPath = join(dir, 'mirror-urls.json');
  writeFileSync(outPath, JSON.stringify({ mirrors: { 'morphe-youtube': { url: 'https://github.com/OLD/x.apk', source: 'Purple-Drain', version: '21.30.216', arch: 'universal', exact: true } } }));
  const stub = stubFetchFactory(LIVE_ASSETS);
  const { report, changed } = await refreshMirrors({
    apps: [{ slug: 'morphe-youtube', version: '21.30.216' }, { slug: 'morphe-instagram', version: '447.0.0.55.81' }],
    fetchFn: stub, outPath, minCoverage: 2,
  });
  assert.equal(report.covered, 2);
  assert.equal(changed, 2); // youtube URL berubah, instagram baru
  const saved = JSON.parse(readFileSync(outPath, 'utf8'));
  assert.equal(saved.mirrors['morphe-youtube'].url, 'https://github.com/Purple-Drain/x/youtube-universal-morphe-v21.30.216.apk');
  assert.equal(saved.mirrors['morphe-instagram'].source, 'Macka323');
});

test('refreshMirrors TIDAK menimpa file kalau cakupan di bawah ambang', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-refresh-'));
  const outPath = join(dir, 'mirror-urls.json');
  const oldContent = JSON.stringify({ mirrors: { 'morphe-youtube': { url: 'https://github.com/OLD/x.apk' } } });
  writeFileSync(outPath, oldContent);
  const stub = stubFetchFactory({ 'Purple-Drain': ['youtube-universal-morphe-v21.30.216.apk'] });
  await assert.rejects(
    refreshMirrors({
      apps: [{ slug: 'morphe-youtube', version: '21.30.216' }, { slug: 'morphe-instagram', version: '447.0.0.55.81' }, { slug: 'morphe-tiktok', version: '46.2.3' }],
      fetchFn: stub, outPath, minCoverage: 3,
    }),
    /di bawah ambang/,
  );
  assert.equal(readFileSync(outPath, 'utf8'), oldContent);
});

test('refreshMirrors lempar kalau API gagal; pemetaan lama aman', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-refresh-'));
  const outPath = join(dir, 'mirror-urls.json');
  writeFileSync(outPath, JSON.stringify({ mirrors: {} }));
  const failing = async () => { throw new Error('jaringan putus'); };
  await assert.rejects(
    refreshMirrors({ apps: [{ slug: 'morphe-youtube', version: '21.30.216' }], fetchFn: failing, outPath, minCoverage: 1 }),
    /jaringan putus/,
  );
});

test('buildSite dengan refreshMirrors pakai pemetaan live; gagal fetch → fallback file lama', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nazuaf-build-refresh-'));
  const dataPath = join(dir, 'apps.json');
  const outDir = join(dir, 'public');
  const app = { slug: 'morphe-youtube', name: 'Morphe YouTube', version: '21.30.216', updated: '2026-11-04', category: 'Video', size_mb: 140, android_min: '9.0', arch: 'Universal', root: false, patch_bundle: '2.0.0', description: 'Test', description_html: null, icon: '/icons/morphe-youtube.webp', download_url: 'https://gitlab.com/x.apk', popular: true, source_url: 'https://morpheapk.com/morphe-youtube/', scraped_at: '2026-11-21T00:00:00Z' };
  writeFileSync(dataPath, JSON.stringify({ apps: [app], generated_at: '2026-11-21T00:00:00Z' }));
  writeFileSync(join(dir, 'mirror-urls.json'), JSON.stringify({ mirrors: { 'morphe-youtube': { url: 'https://github.com/OLD/x.apk', source: 'Purple-Drain', version: '21.30.216', arch: 'universal', exact: true } } }));
  // Live berhasil → URL baru dipakai.
  await buildSite({ dataPath, outDir, refreshMirrors: true, fetchFn: stubFetchFactory(LIVE_ASSETS) });
  let detail = readFileSync(join(outDir, 'apps', 'morphe-youtube', 'index.html'), 'utf8');
  assert.ok(detail.includes('github.com/Purple-Drain/x/youtube-universal-morphe-v21.30.216.apk'));
  // Live gagal → fallback ke file lama (kembalikan dulu URL lama ke file).
  writeFileSync(join(dir, 'mirror-urls.json'), JSON.stringify({ mirrors: { 'morphe-youtube': { url: 'https://github.com/OLD/x.apk', source: 'Purple-Drain', version: '21.30.216', arch: 'universal', exact: true } } }));
  const failing = async () => { throw new Error('jaringan putus'); };
  await buildSite({ dataPath, outDir, refreshMirrors: true, fetchFn: failing });
  detail = readFileSync(join(outDir, 'apps', 'morphe-youtube', 'index.html'), 'utf8');
  assert.ok(detail.includes('github.com/OLD/x.apk'));
});

// Pemetaan tombol Download ke mirror GitHub (fork Morphe-AutoBuilds).
// Sumber GitLab morpheapk.com mati (proyek 87288318 tidak lagi publik, Nov 2026).
// Script ini membaca daftar aset rilis "latest" tiap fork lalu mencocokkan
// per aplikasi berdasarkan nama file; hasilnya disimpan ke data/mirror-urls.json
// dan digabung saat build (lihat build.mjs + lib/mirror.mjs) — jadi sync harian
// dari morpheapk.com tidak menghapus pemetaan ini.
//
// Cara pakai:
//   node scripts/map-mirrors.mjs                     (ambil daftar aset live dari GitHub API, tanpa auth)
//   node scripts/map-mirrors.mjs --assets-dir DIR    (baca daftar aset dari file TSV lokal, format per baris: <nama-file>\t<url>\t<updated_at>\t<ukuran-byte-opsional>)
//   MIRROR_REFRESH=1 node scripts/build.mjs         (build juga memetakan ulang live sebelum render)
//
// Prioritas fork: Purple-Drain (utama, paling segar) → Macka323 (versi paling
// cocok dengan data kita) → rpeters1430 → toidicakhia (difilter: hanya nama file
// hasil patch, APK stok APKMirror tidak cocok pola dan otomatis terlewat).
// Aturan pilih: (1) versi sama persis dengan data situs, urutan prioritas fork;
// (2) kalau tidak ada yang sama persis, versi terbaru dari semua fork.
// Arsitektur diutamakan: universal > arm64-v8a > armeabi-v7a.
// URL rpeters1430 mengandung hash commit dan bisa 404 setelah rebuild — hanya
// dipakai kalau ketiga fork lain tidak punya aplikasi itu.
//
// Guard: pemetaan TIDAK ditulis kalau cakupan < 95/100 atau API gagal —
// pemetaan lama dipertahankan supaya situs tidak rusak. Build memakai
// pemetaan lama itu sebagai fallback kalau fetch live gagal.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORKS = ['Purple-Drain', 'Macka323', 'rpeters1430', 'toidicakhia'];
const ARCH_RANK = { universal: 0, 'arm64-v8a': 1, 'armeabi-v7a': 2, all: 3 };
const MIN_COVERAGE = 0.95; // fraksi minimal aplikasi tercakup (95% dari daftar)

// <key>-<arch>-<patch>-v<version>.apk  (contoh: instagram-arm64-v8a-piko-patches-v452.1.0.53.64.apk)
// Grup patch dibuat non-greedy: versi bisa mengandung "-arm64-v8a" sendiri
// (contoh: gboard-...-v18.5.4.993608717-release-arm64-v8a.apk).
// Key dinormalisasi "_" → "-" (contoh: ibs_paint → ibs-paint).
const ASSET_RE = /^(.+?)-(universal|arm64-v8a|armeabi-v7a|all)-(.+?)-v(.+)\.apk$/;

// Normalisasi untuk perbandingan versi: "32.44.1(1717099)" == "32.44.1.1717099",
// "2.2 build 016" == "2.2.build.016". Hanya dipakai untuk pencocokan, versi
// asli tetap disimpan apa adanya untuk ditampilkan.
function normVersion(v) {
  return String(v).replace(/[()\s]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
}

function cmpVersion(a, b) {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '') {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

function parseAsset(name, url, updatedAt, sizeBytes) {
  if (!name || !url || !name.endsWith('.apk')) return null;
  const m = ASSET_RE.exec(name);
  if (!m) return null;
  return {
    key: m[1].replace(/_/g, '-'), arch: m[2], version: m[4], name, url,
    updated: updatedAt ? String(updatedAt).slice(0, 10) : null,
    size_mb: sizeBytes ? Math.round((sizeBytes / 1e6) * 100) / 100 : null,
  };
}

function loadForkAssets(dir) {
  const out = {};
  for (const fork of FORKS) {
    const file = join(dir, `${fork}.json`);
    let lines = [];
    try {
      lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      console.warn(`lewat: ${file} tidak ada`);
      continue;
    }
    out[fork] = lines.map((l) => {
      const [name, url, updatedAt, sizeBytes] = l.split('\t');
      return parseAsset(name, url, updatedAt, sizeBytes ? Number(sizeBytes) : null);
    }).filter(Boolean);
  }
  return out;
}

const GH_HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'nazuaf-apps-mirror-mapper' };

// Ambil semua aset rilis "latest" tiap fork lewat GitHub API (repo publik, tanpa auth).
// 1) GET /releases/tags/latest → id rilis; 2) GET /releases/{id}/assets (paginasi 100/hal).
export async function fetchForkAssets(fetchFn = fetch) {
  const out = {};
  for (const fork of FORKS) {
    const relRes = await fetchFn(`https://api.github.com/repos/${fork}/Morphe-AutoBuilds/releases/tags/latest`, { headers: GH_HEADERS });
    if (!relRes.ok) throw new Error(`GitHub API ${fork}: HTTP ${relRes.status}`);
    const rel = await relRes.json();
    const assets = [];
    for (let page = 1; page <= 3; page++) {
      const res = await fetchFn(`https://api.github.com/repos/${fork}/Morphe-AutoBuilds/releases/${rel.id}/assets?per_page=100&page=${page}`, { headers: GH_HEADERS });
      if (!res.ok) throw new Error(`GitHub API ${fork} assets p${page}: HTTP ${res.status}`);
      const list = await res.json();
      if (!Array.isArray(list) || list.length === 0) break;
      for (const a of list) {
        const parsed = parseAsset(a.name, a.browser_download_url, a.updated_at, a.size);
        if (parsed) assets.push(parsed);
      }
      if (list.length < 100) break;
    }
    out[fork] = assets;
  }
  return out;
}

export function mapMirrors(apps, forkAssets) {
  const mirrors = {};
  const report = { covered: 0, exact: 0, bySource: {}, unmatched: [], mismatched: [] };
  for (const app of apps) {
    const key = app.slug.replace(/^morphe-/, '');
    let picked = null;
    // Tingkat 1: versi sama persis dengan data situs, urutan prioritas fork.
    for (const fork of FORKS) {
      const exact = (forkAssets[fork] || []).filter((a) => a.key === key && normVersion(a.version) === normVersion(app.version));
      if (!exact.length) continue;
      exact.sort((a, b) => ARCH_RANK[a.arch] - ARCH_RANK[b.arch]);
      picked = { ...exact[0], source: fork, exact: true };
      break;
    }
    // Tingkat 2: tidak ada yang sama persis → versi terbaru dari semua fork.
    if (!picked) {
      const all = [];
      for (const fork of FORKS) {
        for (const a of forkAssets[fork] || []) {
          if (a.key === key) all.push({ ...a, source: fork });
        }
      }
      if (all.length) {
        all.sort((a, b) => cmpVersion(b.version, a.version) || FORKS.indexOf(a.source) - FORKS.indexOf(b.source) || ARCH_RANK[a.arch] - ARCH_RANK[b.arch]);
        picked = { ...all[0], exact: false };
      }
    }
    if (!picked) {
      report.unmatched.push(app.slug);
      continue;
    }
    mirrors[app.slug] = {
      url: picked.url,
      source: picked.source,
      version: picked.version,
      arch: picked.arch,
      exact: picked.exact,
      size_mb: picked.size_mb ?? null,
      updated: picked.updated ?? null,
    };
    report.covered++;
    if (picked.exact) report.exact++;
    else report.mismatched.push(`${app.slug}: situs v${app.version} → mirror v${picked.version} (${picked.source})`);
    report.bySource[picked.source] = (report.bySource[picked.source] || 0) + 1;
  }
  return { mirrors, report };
}

// Petakan ulang mirror untuk daftar aplikasi; tulis file hanya kalau cakupan
// memenuhi ambang. minCoverage: fraksi 0..1 (default 0.95) atau jumlah absolut.
// Mengembalikan { mirrors, report, changed }.
// Melempar Error kalau fetch gagal atau cakupan di bawah ambang — pemanggil
// wajib menangkap dan mempertahankan pemetaan lama.
export async function refreshMirrors({ apps, fetchFn = fetch, assetsDir = null, outPath, minCoverage = MIN_COVERAGE }) {
  const forkAssets = assetsDir ? loadForkAssets(assetsDir) : await fetchForkAssets(fetchFn);
  const { mirrors, report } = mapMirrors(apps, forkAssets);
  const threshold = minCoverage <= 1 ? Math.ceil(apps.length * minCoverage) : minCoverage;
  if (report.covered < threshold) {
    throw new Error(`cakupan mirror ${report.covered}/${apps.length} di bawah ambang ${threshold}; pemetaan lama dipertahankan`);
  }
  let changed = 0;
  let old = {};
  try {
    old = JSON.parse(readFileSync(outPath, 'utf8')).mirrors || {};
  } catch { /* belum ada file */ }
  for (const [slug, m] of Object.entries(mirrors)) {
    if (!old[slug] || old[slug].url !== m.url) changed++;
  }
  const out = {
    generated_at: new Date().toISOString(),
    note: 'Pemetaan mirror unduhan (GitLab sumber mati Nov 2026). Digabung saat build; jangan edit manual, jalankan ulang script ini.',
    mirrors,
  };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  return { mirrors, report, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirIdx = process.argv.indexOf('--assets-dir');
  const assetsDir = dirIdx >= 0 ? process.argv[dirIdx + 1] : null;
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'apps.json'), 'utf8'));
  try {
    const { report, changed } = await refreshMirrors({ apps: data.apps, assetsDir, outPath: join(ROOT, 'data', 'mirror-urls.json') });
    console.log(`mirror: ${report.covered}/${data.apps.length} aplikasi tercakup, ${report.exact} versi sama persis, ${changed} URL berubah`);
    console.log('per sumber:', JSON.stringify(report.bySource));
    if (report.unmatched.length) console.log('TIDAK ADA MIRROR:', report.unmatched.join(', '));
    if (report.mismatched.length) {
      console.log(`versi mirror berbeda (${report.mismatched.length}):`);
      for (const m of report.mismatched) console.log('  ', m);
    }
  } catch (err) {
    console.error(`mirror: GAGAL (${err.message})`);
    process.exit(2);
  }
}

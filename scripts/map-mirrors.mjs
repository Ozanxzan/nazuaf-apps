// Pemetaan tombol Download ke mirror GitHub (fork Morphe-AutoBuilds).
// Sumber GitLab morpheapk.com mati (proyek 87288318 tidak lagi publik, Nov 2026).
// Script ini membaca daftar aset rilis "latest" tiap fork lalu mencocokkan
// per aplikasi berdasarkan nama file; hasilnya disimpan ke data/mirror-urls.json
// dan digabung saat build (lihat build.mjs) — jadi sync harian dari morpheapk.com
// tidak menghapus pemetaan ini.
//
// Penggunaan:
//   1) Unduh daftar aset dulu (tanpa auth, repo publik):
//      for r in Purple-Drain Macka323 rpeters1430 toidicakhia; do
//        curl -s "https://api.github.com/repos/$r/Morphe-AutoBuilds/releases?per_page=100" \
//          | python3 -c "..." > /tmp/mirror-assets/$r.json
//      done
//      (format tiap baris: <nama-file>\t<browser_download_url>\t<updated_at>)
//   2) node scripts/map-mirrors.mjs --assets-dir /tmp/mirror-assets
//
// Prioritas fork: Purple-Drain (utama, paling segar) → Macka323 (versi paling
// cocok dengan data kita) → rpeters1430 → toidicakhia (difilter: hanya nama file
// hasil patch, APK stok APKMirror tidak cocok pola dan otomatis terlewat).
// Dalam satu fork: versi sama persis dengan data kita diutamakan; kalau tidak
// ada, versi terbaru. Arsitektur diutamakan: universal > arm64-v8a > armeabi-v7a.
// URL rpeters1430 mengandung hash commit dan bisa 404 setelah rebuild — hanya
// dipakai kalau ketiga fork lain tidak punya aplikasi itu.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORKS = ['Purple-Drain', 'Macka323', 'rpeters1430', 'toidicakhia'];
const ARCH_RANK = { universal: 0, 'arm64-v8a': 1, 'armeabi-v7a': 2, all: 3 };

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

function parseAsset(line) {
  const [name, url] = line.split('\t');
  if (!name || !url || !name.endsWith('.apk')) return null;
  const m = ASSET_RE.exec(name);
  if (!m) return null;
  return { key: m[1].replace(/_/g, '-'), arch: m[2], version: m[4], name, url };
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
    out[fork] = lines.map(parseAsset).filter(Boolean);
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
    };
    report.covered++;
    if (picked.exact) report.exact++;
    else report.mismatched.push(`${app.slug}: situs v${app.version} → mirror v${picked.version} (${picked.source})`);
    report.bySource[picked.source] = (report.bySource[picked.source] || 0) + 1;
  }
  return { mirrors, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirIdx = process.argv.indexOf('--assets-dir');
  const assetsDir = dirIdx >= 0 ? process.argv[dirIdx + 1] : '/tmp/mirror-assets';
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'apps.json'), 'utf8'));
  const forkAssets = loadForkAssets(assetsDir);
  const { mirrors, report } = mapMirrors(data.apps, forkAssets);
  const out = {
    generated_at: new Date().toISOString(),
    note: 'Pemetaan mirror unduhan (GitLab sumber mati Nov 2026). Digabung saat build; jangan edit manual, jalankan ulang script ini.',
    mirrors,
  };
  writeFileSync(join(ROOT, 'data', 'mirror-urls.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`mirror: ${report.covered}/${data.apps.length} aplikasi tercakup, ${report.exact} versi sama persis`);
  console.log('per sumber:', JSON.stringify(report.bySource));
  if (report.unmatched.length) console.log('TIDAK ADA MIRROR:', report.unmatched.join(', '));
  if (report.mismatched.length) {
    console.log(`versi mirror berbeda (${report.mismatched.length}):`);
    for (const m of report.mismatched) console.log('  ', m);
  }
}

// Generator situs statis dari data/apps.json → public/
// TIDAK menghapus public/icons/ — hanya menulis file HTML + menyalin CSS.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIndex, renderDetail } from './lib/render.mjs';
import { loadMirrors, applyMirrors } from './lib/mirror.mjs';
import { refreshMirrors } from './map-mirrors.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildSite(opts = {}) {
  const dataPath = opts.dataPath || join(ROOT, 'data', 'apps.json');
  const outDir = opts.outDir || join(ROOT, 'public');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  // Mirror unduhan (data/mirror-urls.json, di samping apps.json) — kalau tidak ada, build tetap jalan tanpa mirror.
  const mirrorPath = opts.mirrorPath || join(dirname(dataPath), 'mirror-urls.json');
  let mirrors = loadMirrors(mirrorPath);
  // MIRROR_REFRESH=1: petakan ulang mirror live dari GitHub API sebelum render,
  // supaya versi baru di situs selalu dapat tautan unduhan yang cocok. Gagal →
  // pakai pemetaan lama (fallback), build tidak boleh gagal karena ini.
  if (opts.refreshMirrors || process.env.MIRROR_REFRESH === '1') {
    try {
      const r = await refreshMirrors({ apps: data.apps || [], fetchFn: opts.fetchFn, outPath: mirrorPath });
      mirrors = r.mirrors;
      console.log(`mirror: refresh live ${r.report.covered}/${(data.apps || []).length} tercakup, ${r.changed} URL berubah`);
    } catch (err) {
      console.warn(`mirror: refresh live gagal (${err.message}); pakai pemetaan lama`);
    }
  }
  const apps = applyMirrors(data.apps || [], mirrors);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'apps'), { recursive: true });
  // CSS sudah ada di public/assets/style.css (di-commit); pastikan tetap ada saat build di Pages
  const cssSrc = join(ROOT, 'public', 'assets', 'style.css');
  const cssDst = join(outDir, 'assets', 'style.css');
  if (existsSync(cssSrc) && cssSrc !== cssDst) {
    mkdirSync(join(outDir, 'assets'), { recursive: true });
    copyFileSync(cssSrc, cssDst);
  }
  writeFileSync(join(outDir, 'index.html'), renderIndex(apps, data.generated_at));
  for (const app of apps) {
    const dir = join(outDir, 'apps', app.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderDetail(app));
  }
  console.log(`build: ${apps.length} aplikasi → ${outDir}`);
  return { count: apps.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite().catch((err) => { console.error(err); process.exit(1); });
}

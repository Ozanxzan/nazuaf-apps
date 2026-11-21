// Generator situs statis dari data/apps.json → public/
// TIDAK menghapus public/icons/ — hanya menulis file HTML + menyalin CSS.
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIndex, renderDetail } from './lib/render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildSite(opts = {}) {
  const dataPath = opts.dataPath || join(ROOT, 'data', 'apps.json');
  const outDir = opts.outDir || join(ROOT, 'public');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const apps = data.apps || [];
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

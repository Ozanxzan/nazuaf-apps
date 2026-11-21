// Unduh ikon ke public/icons/<slug>.webp dari icon_src di data/apps.json.
// Dijalankan saat Pages build (dan boleh dijalankan lokal). Ikon TIDAK di-commit
// ke repo — file biner tidak bisa lewat GitHub MCP — jadi tiap build mengunduh
// ulang ikon yang belum ada. Gagal unduh satu ikon = peringatan, build lanjut.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function downloadIcons(opts = {}) {
  const dataPath = opts.dataPath || join(ROOT, 'data', 'apps.json');
  const outDir = opts.outDir || join(ROOT, 'public', 'icons');
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  mkdirSync(outDir, { recursive: true });
  let ok = 0, skipped = 0, failed = 0;
  for (const app of data.apps || []) {
    if (!app.icon_src) { failed++; continue; }
    const dest = join(outDir, `${app.slug}.webp`);
    if (existsSync(dest)) { skipped++; continue; }
    const src = app.icon_src.startsWith('http') ? app.icon_src : `https://morpheapk.com${app.icon_src}`;
    try {
      const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (err) {
      console.warn(`ikon ${app.slug} gagal: ${err.message}`);
      failed++;
    }
  }
  console.log(`ikon: ${ok} diunduh, ${skipped} sudah ada, ${failed} gagal`);
  return { ok, skipped, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadIcons().catch((err) => { console.error(err); process.exit(1); });
}

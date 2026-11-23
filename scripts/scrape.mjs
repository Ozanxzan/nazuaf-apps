// Orkestrator scrape: daftar → 100 detail → validasi → ikon → data/apps.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchHtml, sleep, randomDelay } from './lib/fetch.mjs';
import { parseAppList } from './lib/parse-list.mjs';
import { parseAppDetail } from './lib/parse-detail.mjs';
import { validateApp } from './lib/validate.mjs';
import { normalizeApp, hashContent, writeAppsJson } from './lib/schema.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = join(ROOT, 'data', 'apps.json');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const DEADLINE_MS = 45 * 60 * 1000;

export async function runScrape(deps = {}) {
  const fetchFn = deps.fetchHtml || fetchHtml;
  const started = Date.now();
  const listHtml = await fetchFn('https://morpheapk.com/apps/');
  const { urls, cards, popularSlugs } = parseAppList(listHtml);
  if (urls.length === 0) throw new Error('daftar kosong: 0 URL dari morpheapk.com/apps/');
  const popular = new Set(popularSlugs);
  const apps = [];
  let skipped = 0;
  const warnings = [];
  for (const url of urls) {
    if (Date.now() - started > DEADLINE_MS) {
      console.warn(`deadline 45 menit tercapai, sisa URL dilewati (${urls.length - apps.length - skipped})`);
      skipped += urls.length - apps.length - skipped;
      break;
    }
    try {
      const html = await fetchFn(url);
      const app = parseAppDetail(html, url);
      const slug = app.slug;
      const card = cards[slug];
      if (card) {
        if (!app.category) app.category = card.category;
        if (!app.version) app.version = card.version;
        if (!app.updated) app.updated = card.date;
        if (!app.icon_src) app.icon_src = card.iconSrc;
        if (!app.icon && card.iconSrc) app.icon = `/icons/${slug}.webp`;
      }
      app.popular = popular.has(slug);
      // Unduh ikon (hanya kalau berubah)
      if (app.icon_src && deps.downloadIcon) {
        await deps.downloadIcon(app);
      } else if (app.icon_src) {
        await downloadIcon(app);
      }
      const v = validateApp(app);
      if (v.warnings.length) warnings.push(...v.warnings.map((w) => `${slug}: ${w}`));
      if (app.warnings?.length) warnings.push(...app.warnings.map((w) => `${slug}: ${w}`));
      if (!v.ok) {
        console.warn(`skip ${slug}: ${v.errors.join('; ')}`);
        skipped++;
        continue;
      }
      const { warnings: _w, ...clean } = normalizeApp(app);
      clean.icon_src = app.icon_src || null;
      clean.popular = app.popular;
      clean.description_html = app.description_html ?? null;
      apps.push(clean);
    } catch (err) {
      console.warn(`skip ${url}: ${err.message}`);
      skipped++;
    }
    await sleep(deps.delayMs ?? randomDelay(1000, 2000));
  }
  return { apps, skipped, warnings };
}

async function downloadIcon(app) {
  try {
    mkdirSync(ICONS_DIR, { recursive: true });
    const src = app.icon_src.startsWith('http') ? app.icon_src : `https://morpheapk.com${app.icon_src}`;
    const res = await fetch(src, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = join(ICONS_DIR, `${app.slug}.webp`);
    if (existsSync(dest)) {
      const old = readFileSync(dest);
      if (createHash('sha256').update(old).digest('hex') === createHash('sha256').update(buf).digest('hex')) return;
    }
    writeFileSync(dest, buf);
  } catch (err) {
    console.warn(`ikon ${app.slug} gagal diunduh (${err.message}); ikon lama dipertahankan bila ada`);
    if (!existsSync(join(ICONS_DIR, `${app.slug}.webp`))) app.icon = null;
  }
}

async function main() {
  const { apps, skipped, warnings } = await runScrape();
  for (const w of warnings) console.warn('WARN:', w);
  console.log(`hasil: ${apps.length} valid, ${skipped} dilewati`);
  if (apps.length === 0) {
    console.error('ERROR: 0 aplikasi valid — tidak ada commit');
    process.exit(1);
  }
  if (skipped > 5 || apps.length < 50) {
    console.error(`ERROR: skipped=${skipped} apps=${apps.length} — ambang alarm terlampaui`);
    // Tetap tulis data yang valid, tapi keluar dengan kode 2 supaya job terlihat gagal
    writeData(apps);
    process.exit(2);
  }
  writeData(apps);
}

function writeData(apps) {
  let oldHash = null;
  try {
    const old = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    oldHash = hashContent(old.apps || []);
  } catch { /* belum ada file */ }
  const newHash = hashContent(apps);
  if (oldHash === newHash) {
    // Isi aplikasi sama, tapi generated_at tetap diperbarui: tanggal
    // "Terakhir diperbarui" di situs harus mencerminkan sinkronisasi
    // terakhir yang berhasil, bukan perubahan konten terakhir.
    // (Sebelumnya: file tidak ditulis ulang di sini, jadi tanggal mentok
    // di 21 Nov 2026 walau sync jalan 3x sehari.)
    console.log('tidak ada perubahan konten — hanya perbarui generated_at');
  }
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(DATA_PATH, writeAppsJson(apps, new Date().toISOString()));
  console.log(`data/apps.json ditulis: ${apps.length} aplikasi`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

// Penggabungan pemetaan mirror unduhan (data/mirror-urls.json) ke data aplikasi.
// Dipisah dari scrape: scrape menulis ulang data/apps.json dari morpheapk.com,
// sedangkan mirror-urls.json adalah file statis hasil scripts/map-mirrors.mjs
// yang digabung di sini saat build — jadi sync harian tidak menghapusnya.
import { readFileSync, existsSync } from 'node:fs';

export function loadMirrors(mirrorPath) {
  if (!mirrorPath || !existsSync(mirrorPath)) return {};
  try {
    const data = JSON.parse(readFileSync(mirrorPath, 'utf8'));
    return data.mirrors || {};
  } catch {
    console.warn(`mirror: gagal membaca ${mirrorPath}, lanjut tanpa mirror`);
    return {};
  }
}

export function applyMirrors(apps, mirrors) {
  return apps.map((app) => {
    const m = mirrors[app.slug];
    if (!m || !m.url) return app;
    return {
      ...app,
      download_mirror_url: m.url,
      mirror_source: m.source,
      mirror_version: m.version,
      mirror_exact: m.exact === true,
    };
  });
}

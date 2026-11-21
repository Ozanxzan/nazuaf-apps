// Penggabungan pemetaan mirror unduhan (data/mirror-urls.json) ke data aplikasi.
// Dipisah dari scrape: scrape menulis ulang data/apps.json dari morpheapk.com,
// sedangkan mirror-urls.json adalah file statis hasil scripts/map-mirrors.mjs
// yang digabung di sini saat build — jadi sync harian tidak menghapusnya.
//
// Versi yang tampil mengikuti file mirror: nama + versi di halaman HARUS sama
// dengan file yang diunduh. Jadi kalau ada mirror, app.version diganti dengan
// versi mirror (aslinya disimpan di morphe_version), begitu juga ukuran file
// dan tanggal update — tanggal selalu ikut tanggal file mirror, bukan tanggal
// di data Morphe (Morphe menandai 66 aplikasi sekaligus 4 Nov 2026).
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
    const out = {
      ...app,
      download_mirror_url: m.url,
      mirror_source: m.source,
      mirror_version: m.version,
      mirror_exact: m.exact === true,
    };
    if (m.version) {
      out.morphe_version = app.version;
      out.version = m.version;
      if (m.updated) out.updated = m.updated;
      if (m.size_mb) out.size_mb = m.size_mb;
    }
    return out;
  });
}

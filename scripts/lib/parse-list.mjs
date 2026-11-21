// Parse halaman daftar https://morpheapk.com/apps/
// Sumber kanonis URL: JSON-LD ItemList. Fallback: kartu .apps-row.
// Ikon/kategori/versi/tanggal daftar: dari kartu .apps-row.
import { slugFromUrl } from './schema.mjs';

function parseJsonLdList(html) {
  const urls = [];
  const re = /<script type=application\/ld\+json>(.*?)<\/script>/gs;
  for (const m of html.matchAll(re)) {
    try {
      const d = JSON.parse(m[1]);
      if (d['@type'] === 'ItemList' && Array.isArray(d.itemListElement)) {
        for (const it of d.itemListElement) {
          if (it.url) urls.push(it.url);
        }
      }
    } catch { /* abaikan blok JSON-LD rusak */ }
  }
  return urls;
}

export function parseAppList(html) {
  let urls = parseJsonLdList(html);
  const cards = {};
  const popularSlugs = [];

  // Kartu daftar: <a class=apps-row href=/morphe-aiocal/ ...><img src=/img/apps/aiocal.webp>...<span class=apps-row-name>Aiocal</span><span class=apps-row-meta>Tools · v3.4.0</span><span class=apps-row-date>...07 Oct 2026</span>
  const rowRe = /<a class=apps-row href=([^ >]+)[^>]*>\s*<img[^>]+src=([^ >]+)[^>]*>\s*<span class=apps-row-body><span class=apps-row-name>([^<]+)<\/span>\s*<span class=apps-row-meta>([^<]+)<\/span><span class=apps-row-date>(?:<[^>]+>)*\s*([^<]+)<\/span>/g;
  for (const m of html.matchAll(rowRe)) {
    const href = m[1].replace(/['"]/g, '');
    const slug = slugFromUrl(href);
    if (!slug) continue;
    const meta = m[4].trim(); // "Tools · v3.4.0"
    const [category, version] = meta.split('·').map((s) => s.trim());
    cards[slug] = {
      iconSrc: m[2].replace(/['"]/g, ''),
      category: category || null,
      version: (version || '').replace(/^v/i, '') || null,
      date: m[5].trim(),
    };
  }

  // Fallback kalau JSON-LD hilang: URL dari kartu
  if (urls.length === 0) {
    const hrefRe = /<a class=apps-row href=([^ >]+)/g;
    for (const m of html.matchAll(hrefRe)) {
      const href = m[1].replace(/['"]/g, '');
      urls.push(new URL(href, 'https://morpheapk.com').href);
    }
  }

  // Popular: <a class=apps-popular-item href=/morphe-youtube/>...
  const popRe = /<a class=apps-popular-item href=([^ >]+)/g;
  for (const m of html.matchAll(popRe)) {
    const slug = slugFromUrl(m[1].replace(/['"]/g, ''));
    if (slug) popularSlugs.push(slug);
  }

  return { urls, cards, popularSlugs };
}

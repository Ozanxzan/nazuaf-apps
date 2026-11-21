// Parse halaman detail, contoh https://morpheapk.com/morphe-youtube/
// Urutan: JSON-LD SoftwareApplication → tabel .ap-info → kartu/artikel.
// download_url = href tombol .ap-dl bila ada (menang atas downloadUrl JSON-LD, beri warning kalau beda).
import { parseSizeMb, parseDateId, parseRoot, slugFromUrl, normalizeApp } from './schema.mjs';

function parseJsonLdApp(html) {
  const re = /<script type=application\/ld\+json>(.*?)<\/script>/gs;
  for (const m of html.matchAll(re)) {
    try {
      const d = JSON.parse(m[1]);
      if (d['@type'] === 'SoftwareApplication') return d;
    } catch { /* abaikan */ }
  }
  return null;
}

function parseInfoTable(html) {
  const info = {};
  const ul = html.match(/<ul class=ap-info>(.*?)<\/ul>/s);
  if (!ul) return info;
  const liRe = /<li><span>([^<]+)<\/span><span>([^<]+)<\/span><\/li>/g;
  for (const m of ul[1].matchAll(liRe)) {
    info[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return info;
}

export function parseAppDetail(html, sourceUrl) {
  const warnings = [];
  const slug = slugFromUrl(sourceUrl);
  const ld = parseJsonLdApp(html);
  const info = parseInfoTable(html);

  // Tombol download
  let downloadUrl = ld?.downloadUrl || null;
  const dlMatch = html.match(/<a href=(https:\/\/[^ >]+\.apk)[^>]*class="btn btn-primary ap-dl"/)
    || html.match(/<a href=(https:\/\/[^ >]+\.apk)[^>]*>/);
  // Cari spesifik tombol .ap-dl dulu
  const apDl = html.match(/<a href=([^\s>]+) class="btn btn-primary ap-dl"/);
  if (apDl) {
    const href = apDl[1];
    if (downloadUrl && href !== downloadUrl) {
      warnings.push(`download_url tombol (${href}) berbeda dari JSON-LD (${downloadUrl}); memakai tombol`);
    }
    downloadUrl = href;
  } else if (dlMatch && !downloadUrl) {
    downloadUrl = dlMatch[1];
  }

  // Ikon: data-pagefind-meta=image:/img/apps/youtube-morphe.webp
  let iconSrc = null;
  const iconMeta = html.match(/data-pagefind-meta=image:([^" >]+)/);
  if (iconMeta) iconSrc = iconMeta[1];

  // Artikel panjang
  let descriptionHtml = null;
  const article = html.match(/<article class="ap-section ap-about blog-content"[^>]*>(.*?)<\/article>/s);
  if (article) descriptionHtml = article[1].trim();

  const version = info.version || (ld?.softwareVersion ? String(ld.softwareVersion) : null);
  const updatedRaw = info.updated || (ld?.dateModified ? ld.dateModified.slice(0, 10) : null);
  const sizeRaw = info.size || ld?.fileSize || null;
  const androidRaw = info.requires || ld?.softwareRequirements || null;

  const raw = {
    slug,
    name: ld?.name || null,
    version: version ? String(version).replace(/^v/i, '') : null,
    updated: parseDateId(updatedRaw),
    category: info.category || null,
    size_mb: parseSizeMb(sizeRaw),
    android_min: androidRaw ? String(androidRaw).replace(/^Android\s*/i, '').replace(/\+$/, '') : null,
    arch: info.architecture || null,
    root: parseRoot(info.root),
    patch_bundle: info['bundle version'] || null,
    description: ld?.description || null,
    description_html: descriptionHtml,
    icon: iconSrc ? `/icons/${slug}.webp` : null,
    icon_src: iconSrc,
    download_url: downloadUrl,
    popular: false,
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
    warnings,
  };
  const app = normalizeApp(raw);
  // normalizeApp tidak mengenal icon_src / warnings — kembalikan keduanya
  app.icon_src = raw.icon_src;
  app.warnings = warnings;
  return app;
}

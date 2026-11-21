// Skema + normalisasi data aplikasi. Zero-dependency.
import { createHash as _createHash } from 'node:crypto';
export const APPS_SCHEMA_KEYS = [
  'slug', 'name', 'version', 'updated', 'category', 'size_mb',
  'android_min', 'arch', 'root', 'patch_bundle', 'description',
  'description_html', 'icon', 'download_url', 'popular',
  'source_url', 'scraped_at',
];

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10',
  november: '11', december: '12',
};

export function parseSizeMb(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const m = String(s).trim().match(/([\d.,]+)\s*(MB|GB|KB)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(num)) return null;
  const unit = (m[2] || 'MB').toUpperCase();
  if (unit === 'GB') return Math.round(num * 1024 * 100) / 100;
  if (unit === 'KB') return Math.round((num / 1024) * 100) / 100;
  return num;
}

export function parseDateId(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  // "04 Nov 2026" atau "4 November 2026"
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
  }
  // "November 4, 2026"
  m = t.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[2].padStart(2, '0')}`;
  }
  // ISO dengan waktu "2026-11-04T14:01:36+00:00"
  return null;
}

const ROOT_MAP = {
  'not needed': false, 'not required': false, 'no': false,
  'required': true, 'yes': true, 'needed': true,
};

export function parseRoot(s) {
  if (s == null) return null;
  if (typeof s === 'boolean') return s;
  const key = String(s).trim().toLowerCase();
  return key in ROOT_MAP ? ROOT_MAP[key] : null;
}

export function slugFromUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url, 'https://morpheapk.com');
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  } catch {
    return String(url).split('/').filter(Boolean).pop() || '';
  }
}

export function normalizeApp(raw = {}) {
  const out = {};
  for (const k of APPS_SCHEMA_KEYS) out[k] = raw[k] ?? null;
  if (typeof out.size_mb === 'string') out.size_mb = parseSizeMb(out.size_mb);
  if (typeof out.updated === 'string') out.updated = parseDateId(out.updated) ?? out.updated;
  if (typeof out.root === 'string') out.root = parseRoot(out.root);
  if (out.version && !String(out.version).startsWith('v') && /^\d/.test(String(out.version))) {
    // versi di tabel detail tanpa 'v' (21.30.216) — simpan apa adanya, prefix 'v' hanya untuk tampilan daftar
  }
  if (out.slug) out.slug = slugFromUrl(out.slug) || out.slug;
  return out;
}

export function hashContent(apps) {
  const slim = (apps || []).map((a) => {
    const { scraped_at, ...rest } = a;
    return rest;
  });
  return _createHash('sha256').update(JSON.stringify(slim)).digest('hex');
}

export function writeAppsJson(apps, generatedAt) {
  return JSON.stringify({ apps, generated_at: generatedAt }, null, 2) + '\n';
}

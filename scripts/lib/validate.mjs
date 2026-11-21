// Validasi satu aplikasi. Host bukan gitlab.com → warning, ok tetap true.
export function validateApp(app) {
  const errors = [];
  const warnings = [];
  if (!app?.slug) errors.push('slug kosong');
  if (!app?.name) errors.push('name kosong');
  if (!app?.version) errors.push('version kosong');
  if (!app?.download_url) {
    errors.push('download_url kosong');
  } else if (!/^https:\/\//.test(app.download_url)) {
    errors.push('download_url bukan https');
  } else if (!app.download_url.startsWith('https://gitlab.com/')) {
    warnings.push(`download_url host bukan gitlab.com: ${app.download_url}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Render HTML statis, tema Nazuaf Alive.
export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDateId(iso) {
  if (!iso) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function shell({ title, desc, body, extraHead = '' }) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="stylesheet" href="/assets/style.css">${extraHead}</head><body><header class="site-header"><div class="wrap"><a class="brand" href="/"><span class="brand-mark">n</span><span class="brand-text">morphe<span>.nazuaf.com</span></span></a><nav class="site-nav"><a href="https://nazuaf.com">Blog nazuaf.com</a><form class="site-search" action="/" method="get" role="search"><input type="search" name="q" placeholder="Cari aplikasi..." aria-label="Cari aplikasi"><button type="submit" aria-label="Cari"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></button></form></nav></div></header><main class="wrap">${body}</main><footer class="site-footer"><div class="wrap"><p>APKs are built by the community AutoBuilds pipeline, not by the Morphe team or this site. Download and install at your own risk.</p><p><a href="https://nazuaf.com">nazuaf.com</a> — Teknologi, Informasi, dan Inspirasi Digital.</p></div></footer></body></html>`;
}

export function renderIndex(apps, generatedAt) {
  const popular = apps.filter((a) => a.popular);
  const cards = apps.map((a) => `
    <a class="app-card" href="/apps/${esc(a.slug)}/" data-search="${esc(`${a.name} ${a.category || ''} ${a.description || ''}`.toLowerCase())}">
      <img class="app-icon" src="${esc(a.icon || '/assets/icon-placeholder.svg')}" alt="Ikon ${esc(a.name)}" width="56" height="56" loading="lazy">
      <span class="app-body"><span class="app-name">${esc(a.name?.replace(/^Morphe /, ''))}</span>
      <span class="app-meta">${esc(a.category || '')} · v${esc(a.version || '')}</span>
      <span class="app-date">${esc(formatDateId(a.updated))}</span></span>
      <span class="app-get" aria-hidden="true">↓</span>
    </a>`).join('');
  const popCards = popular.map((a) => `
    <a class="pop-item" href="/apps/${esc(a.slug)}/"><img src="${esc(a.icon || '')}" alt="" width="64" height="64" loading="lazy"><span>${esc(a.name?.replace(/^Morphe /, ''))}</span></a>`).join('');
  const body = `
    <section class="hero"><h1>Aplikasi Morphe, sudah di-patch.</h1><p>Sekitar ${apps.length} aplikasi Android siap pasang — dari YouTube dan Reddit sampai Instagram dan Duolingo — dengan patch resmi Morphe atau komunitas. Tanpa root.</p>
    <p class="updated">Terakhir diperbarui: ${esc(formatDateId(generatedAt))}</p></section>
    <section><h2>Popular</h2><div class="popular">${popCards}</div></section>
    <section><h2>Semua Aplikasi <span class="count">${apps.length}</span></h2>
    <input id="q" type="search" placeholder="Cari ${apps.length} aplikasi..." aria-label="Cari aplikasi">
    <div class="apps-list" id="appsList">${cards}</div>
    <p id="noResult" hidden>Tidak ada aplikasi bernama itu. Coba kata kunci lain.</p></section>
    <script>
      const q = document.getElementById('q');
      const list = document.getElementById('appsList');
      const noResult = document.getElementById('noResult');
      const headerQ = document.querySelector('.site-search input');
      function applyFilter() {
        const needle = q.value.trim().toLowerCase();
        let shown = 0;
        for (const card of list.children) {
          const hit = !needle || card.dataset.search.includes(needle);
          card.style.display = hit ? '' : 'none';
          if (hit) shown++;
        }
        noResult.hidden = shown > 0;
      }
      q.addEventListener('input', () => { if (headerQ) headerQ.value = q.value; applyFilter(); });
      if (headerQ) headerQ.addEventListener('input', () => { q.value = headerQ.value; applyFilter(); });
      const initial = new URLSearchParams(location.search).get('q');
      if (initial) { q.value = initial; if (headerQ) headerQ.value = initial; applyFilter(); }
    </script>`;
  return shell({ title: 'Aplikasi Morphe — morphe.nazuaf.com', desc: `Daftar ${apps.length} aplikasi Android pre-patched Morphe, diperbarui otomatis.`, body });
}

export function renderDetail(app) {
  const rows = [
    ['Versi', app.version ? `v${app.version}` : null],
    ['Ukuran', app.size_mb ? `${app.size_mb} MB` : null],
    ['Diperbarui', formatDateId(app.updated)],
    ['Android', app.android_min ? `Android ${app.android_min}+` : null],
    ['Kategori', app.category],
    ['Arsitektur', app.arch],
    ['Bundle patch', app.patch_bundle],
    ['Root', app.root === false ? 'Tidak perlu' : app.root === true ? 'Perlu' : null],
  ].filter(([, v]) => v);
  const rowsHtml = rows.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('');
  // Tombol Download memakai mirror GitHub kalau ada (tautan GitLab sumber mati
  // sejak Nov 2026); kalau tidak ada mirror, tetap pakai download_url asli.
  const dlUrl = app.download_mirror_url || app.download_url;
  const mirrorNote = app.download_mirror_url
    ? `<p class="note">Download from the ${esc(app.mirror_source)} GitHub mirror${!app.mirror_exact && app.morphe_version ? ` — the version shown follows the mirror file (v${esc(app.version)})` : ''}. The mirror is signed with a different key, so uninstall the original version from PlayStore before installing this one.</p>`
    : `<p class="note">APK dibuat pipeline komunitas AutoBuilds, bukan oleh tim Morphe maupun situs ini. Link diteruskan ke sumber aslinya dan di-refresh beberapa kali sehari. Pasang dengan risiko sendiri.</p>`;
  const body = `
    <nav class="crumbs"><a href="/">Semua Aplikasi</a> / ${esc(app.name)}</nav>
    <section class="detail-head">
      <img class="detail-icon" src="${esc(app.icon || '')}" alt="Ikon ${esc(app.name)}" width="96" height="96">
      <div><h1>${esc(app.name)}</h1><p class="detail-meta">${esc(app.category || '')} · v${esc(app.version || '')} · ${esc(formatDateId(app.updated))}</p>
      <p>${esc(app.description || '')}</p></div>
    </section>
    <a class="btn-download" href="${esc(dlUrl)}" target="_blank" rel="noopener nofollow">Download APK${app.size_mb ? ` (${esc(app.size_mb)} MB)` : ''}</a>
    ${mirrorNote}
    <section><h2>Detail aplikasi</h2><ul class="info">${rowsHtml}</ul></section>
    ${app.description_html ? `<section class="about">${app.description_html}</section>` : ''}`;
  return shell({ title: `${app.name} v${app.version} — morphe.nazuaf.com`, desc: app.description || `${app.name} APK dengan patch Morphe.`, body });
}

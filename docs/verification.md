# Verifikasi — 21 Nov 2026

## Scrape live (lokal, `node scripts/scrape.mjs`)

- Hasil: **100 valid, 0 dilewati**, exit 0, durasi ~236 detik (jeda 1–2 detik per aplikasi).
- Host download: semuanya `gitlab.com` — asumsi validasi di desain terbukti untuk 100/100 aplikasi.
- Ikon: 100/100 terunduh ke `public/icons/<slug>.webp`, tidak ada yang hilang.

## Build lokal (`node scripts/build.mjs` + `npm test`)

- Tes: 16/16 lolos.
- Build: 100 aplikasi → `public/`, 100 halaman detail, 8 Popular, ikon lengkap.
- Perbandingan 5 aplikasi dengan Morphe (versi + tanggal + download_url):
  - morphe-youtube: 21.30.216, 2026-11-04 — sama
  - morphe-instagram: 447.0.0.55.81, 2026-11-04 — sama
  - morphe-reddit: 2026.40.0, 2026-11-04 — sama
  - morphe-tiktok: 46.2.3, 2026-11-04 — sama
  - morphe-duolingo: 6.98.4, 2026-11-04 — sama

## Cloudflare Pages (21 Nov 2026, 10.25 WIB)

- Project `nazuaf-apps` dibuat via API: https://nazuaf-apps.pages.dev
- Source: GitHub Ozanxzan/nazuaf-apps, branch main, auto-deploy aktif.
- Build command: `node scripts/download-icons.mjs && node scripts/build.mjs`, output `public/`.

## Yang belum terverifikasi (menunggu repo GitHub)

- Push ke `Ozanxzan/nazuaf-apps` — repo belum dibuat Zan (GitHub App Muse ditolak `create_repository` 403).
- Workflow sync manual (`workflow_dispatch`) + run kedua tanpa perubahan (tidak ada commit baru).
- Deployment Cloudflare Pages + domain `morphe.nazuaf.com`.

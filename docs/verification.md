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
- Deployment pertama sukses 10.25 WIB (3 deployment sukses tercatat); halaman utama terverifikasi live: 100 aplikasi + ikon tampil.

## Domain morphe.nazuaf.com (21 Nov 2026, 10.32–10.34 WIB)

- Domain dipasang ke project Pages; CNAME `morphe` → `nazuaf-apps.pages.dev` dibuat di zona nazuaf.com.
- Sempat error 522 karena CNAME masih proxied — Pages tidak bisa memverifikasi (`CNAME record not set`). Diperbaiki jadi DNS-only (proxied: false), verifikasi jadi `active`, situs terverifikasi live 10.34 WIB: 100 aplikasi + ikon di https://morphe.nazuaf.com/.

## Repo GitHub (21 Nov 2026)

- Repo `Ozanxzan/nazuaf-apps` dibuat Zan; 9 commit per 10.50 WIB, HEAD `e8771487`.
- Catatan izin: token Muse TIDAK bisa membuat file di `.github/workflows/` lewat API (403, GitHub App tanpa izin Workflows) dan tidak ada tool MCP untuk `workflow_dispatch`. File workflow dibuat Zan dari web GitHub; sempat salah letak (`github/workflows/`, lalu `. github/workflows/` karena spasi) sebelum akhirnya benar di `.github/workflows/sync.yml`.
- Ikon TIDAK di-commit ke repo: `data/apps.json` menyimpan `icon_src`, ikon diunduh saat build Pages.

## Workflow sync — run #1 (21 Nov 2026, 10.51–10.54 WIB)

- Dipicu manual (workflow_dispatch) oleh Ozanxzan; run #1 (id 44858138647) **sukses** 3 mnt 8 dtk: npm test, scrape, build, commit — semua hijau.
- Tidak ada commit baru: data sama seperti scrape pagi (Morphe terakhir update 4 Nov 2026) — sesuai harapan.
- Warning: Node.js 20 deprecated, actions dipaksa jalan di Node.js 24 (tidak menghambat).

## Yang belum terverifikasi

- Run ke-2 tanpa perubahan data (tidak ada commit baru). Dijadwalkan otomatis oleh cron workflow pukul 00.00 WIB (17.00 UTC); Muse tidak bisa memicu dispatch sendiri — verifikasi menyusul dari run cron pertama.

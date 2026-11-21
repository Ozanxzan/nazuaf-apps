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

## Mirror unduhan — GitLab sumber mati (21 Nov 2026, 11.10–13.30 WIB)

- Laporan Zan 11.10 WIB: tombol Download di morphe.nazuaf.com mengembalikan 404. Diverifikasi: URL GitLab yang kita simpan sama persis dengan tautan live morpheapk.com, tapi proyek GitLab 87288318 sudah tidak publik lagi (API: 404 Project Not Found; unduh paket: 401; pencarian GitLab: kosong). Repo builder asli RookieEnough/Morphe-AutoBuilds juga sudah tanpa releases. Jadi yang mati adalah sumbernya, bukan situs kita.
- Riset mirror (browser.search + GitHub API + curl range request): fork-fork Morphe-AutoBuilds masih hidup. Yang dipakai: **Purple-Drain** (utama), Macka323, rpeters1430, toidicakhia. Alternatif lain yang dicek tapi tidak dipakai: krvstek/uni-apks (hanya YouTube/Music/Reddit, 3 aplikasi), X-Abhishek-X/Morphe-Automated-Build-Scripts (27 aset, hanya 5 versi sama persis), vanced.to (target tombol download tidak bisa diekstrak).
- Pemetaan: `scripts/map-mirrors.mjs` membaca daftar aset rilis `latest` tiap fork lalu mencocokkan per aplikasi (aturan: versi sama persis dulu, kalau tidak ada ambil versi terbaru; arsitektur universal > arm64-v8a). Hasil 21 Nov 13.20 WIB: **100/100 aplikasi tercakup, 84 versi sama persis** (Purple-Drain 76, Macka323 6, rpeters1430 16, toidicakhia 2). 9 URL contoh dites dengan range request: semua HTTP 206.
- Implementasi: `data/mirror-urls.json` (statis, hasil map-mirrors) digabung saat build oleh `scripts/lib/mirror.mjs` — jadi sync harian dari morpheapk.com tidak menghapus pemetaan. `scripts/lib/render.mjs`: tombol Download memakai URL mirror kalau ada, plus catatan "mirror ditandatangani kunci berbeda, hapus instalasi lama dulu" dan versi mirror kalau berbeda dari versi di halaman. URL GitLab lama tetap tersimpan di `data/apps.json` sebagai fallback kalau suatu hari pulih.
- Tes: 23/23 lolos (16 lama + 7 baru di `test/mirror.test.mjs`: prioritas exact, normalisasi underscore, versi berisi `-arm64-v8a`, merge build, render mirror/tanpa mirror).
- Build lokal: 100 aplikasi → `public/`, 100/100 halaman detail memakai mirror + catatan uninstall.
- Catatan: rilis `latest` bersifat rolling — URL mirror bisa 404 kalau versinya naik; pemetaan perlu dijalankan ulang berkala (`node scripts/map-mirrors.mjs`, daftar aset di `/tmp/mirror-assets/` perlu di-refresh dulu dari GitHub API).

## Auto-refresh mirror — versi aplikasi ikut update otomatis (21 Nov 2026, 13.45 WIB)

- Masalah yang ditanyakan Zan: kalau Morphe meng-update versi aplikasi, nama versi di situs harus ikut update DAN tautan unduhan harus tetap cocok. Nama versi di situs sudah otomatis (scrape 3x sehari dari morpheapk.com). Yang belum otomatis: pemetaan mirror di `data/mirror-urls.json` yang statis — begitu fork mirror membangun versi baru, URL lama bisa 404 karena rilis `latest` bersifat rolling.
- Solusi (tanpa ubah workflow — file `.github/workflows/sync.yml` tidak bisa diedit token Muse, dan commit workflow hanya `git add data/apps.json`):
  - `scripts/map-mirrors.mjs` kini mengambil daftar aset **langsung dari GitHub API** (tanpa auth; `GET /releases/tags/latest` → `GET /releases/{id}/assets`, paginasi 100/hal). Mode `--assets-dir` tetap ada untuk pemakaian lokal/offline.
  - `scripts/build.mjs` mendukung `MIRROR_REFRESH=1`: sebelum render, pemetaan dihitung ulang live lalu digabung; kalau fetch gagal atau cakupan < 95%, build memakai pemetaan lama sebagai fallback dan TIDAK gagal.
  - Perintah build Cloudflare Pages diubah via API menjadi `node scripts/download-icons.mjs && MIRROR_REFRESH=1 node scripts/build.mjs` (destination `public`, tidak berubah). Jadi setiap sync (3x sehari) yang memicu deploy Pages akan memetakan ulang mirror — versi baru di situs langsung dapat tautan unduhan yang cocok.
  - Guard: `refreshMirrors()` menolak menulis kalau cakupan < 95% (fraksi 0.95 dari daftar) atau API gagal; pemetaan lama dipertahankan.
- Verifikasi: `node scripts/map-mirrors.mjs` live → 100/100 tercakup, 84 sama persis, 0 URL berubah (pemetaan yang di-commit sudah mutakhir). `MIRROR_REFRESH=1 node scripts/build.mjs` → 100/100 halaman pakai mirror. Tes: 28/28 lolos (23 lama + 5 baru: fetchForkAssets stub, guard cakupan, fallback build).

## Versi tampil mengikuti file mirror (21 Nov 2026, 13.50 WIB)

- Permintaan Zan: nama aplikasi dan versi di situs harus sama dengan yang diunduh. Sebelumnya, kalau versi mirror berbeda dari data Morphe, halaman menampilkan versi Morphe tapi mengunduh versi mirror (hanya dijelaskan di catatan).
- Perubahan: `scripts/lib/mirror.mjs` (applyMirrors) kini mengganti `version` dengan versi mirror kalau ada mirror (aslinya disimpan di `morphe_version`), begitu juga ukuran file; tanggal update ikut tanggal file mirror kalau versinya berbeda. `scripts/map-mirrors.mjs` menyimpan `size_mb` + `updated` tiap entri (dari GitHub API: `size` dan `updated_at` aset). `scripts/lib/render.mjs`: catatan halaman detail berubah jadi "versi di halaman ini mengikuti file mirror (vX); morpheapk.com masih menampilkan vY" untuk 16 aplikasi yang versinya berbeda.
- Verifikasi: 29/29 tes lolos. Build live: Instagram (exact) tetap v447.0.0.55.81 tanggal 4 Nov 2026; Crunchyroll tampil v3.99.3 (mirror, ukuran 95,3 MB, tanggal file 25 Jun 2026) dengan catatan Morphe masih menampilkan v3.75.0; X tampil v12.19.1-release.0 dengan catatan Morphe masih menampilkan v12.39.0-prod.01. Tepat 16/100 halaman menampilkan catatan versi mirror. Halaman utama juga menampilkan versi mirror.

## Hapus atribusi MorpheAPK, catatan download bahasa Inggris (21 Nov 2026, 14.00 WIB)

- Permintaan Zan: hapus tulisan "Sumber: MorpheAPK" (navigasi), "Data dari morpheapk.com" (footer), dan "Tautan asli GitLab morpheapk.com sedang tidak bisa diakses." (catatan download); catatan download diganti bahasa Inggris.
- Perubahan di `scripts/lib/render.mjs`: tautan navigasi "Sumber: MorpheAPK" dihapus; footer kini hanya "APK dibuat pipeline komunitas AutoBuilds, bukan oleh tim Morphe maupun situs ini. Unduh dan pasang dengan risiko sendiri."; catatan download menjadi "Download from the {sumber} GitHub mirror. The mirror is signed with a different key, so uninstall the old version before installing this one." (nama mirror mengikuti sumber sebenarnya per aplikasi — Purple-Drain, Macka323, dst. — bukan selalu Purple-Drain). Klausul versi tetap ada dalam bahasa Inggris untuk 16 aplikasi yang versinya berbeda: "the version shown follows the mirror file (vX); morpheapk.com still lists vY".
- Verifikasi: 29/29 tes lolos; build lokal 100 halaman: 0 kemunculan ketiga tulisan yang dihapus di seluruh `public/`.

## Yang belum terverifikasi

- Run ke-2 tanpa perubahan data (tidak ada commit baru). Dijadwalkan otomatis oleh cron workflow pukul 00.00 WIB (17.00 UTC); Muse tidak bisa memicu dispatch sendiri — verifikasi menyusul dari run cron pertama.

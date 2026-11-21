# morphe.nazuaf.com — Mirror Daftar Aplikasi Morphe

Website statis yang menampilkan daftar aplikasi Android pre-patched Morphe,
dengan halaman detail tiap aplikasi. Data diambil dari https://morpheapk.com/apps/
dan diperbarui otomatis. Link download diteruskan ke sumber aslinya (GitLab);
situs ini **tidak hosting file APK**.

- Live: https://morphe.nazuaf.com (v1: `*.pages.dev`)
- Repo: `Ozanxzan/nazuaf-apps`
- Tema: sama seperti blog nazuaf.com (Nazuaf Alive)

## Cara sync bekerja

1. GitHub Actions cron 3x sehari — `0 17,1,9 * * *` UTC = 00.00 / 08.00 / 16.00 WIB
   (bisa juga dijalankan manual lewat `workflow_dispatch`).
2. `scripts/scrape.mjs` fetch halaman daftar, ambil 100 URL dari JSON-LD ItemList,
   lalu fetch tiap halaman detail satu-satu dengan jeda 1–2 detik.
3. Parsing berurutan: JSON-LD `SoftwareApplication` → tabel `.ap-info` →
   kartu daftar. Ikon diunduh ke `public/icons/<slug>.webp` (bukan hotlink).
   Ikon **tidak di-commit** ke repo (file biner tidak bisa lewat GitHub MCP) —
   tiap build (Actions maupun Pages) mengunduh ulang ikon yang belum ada
   lewat `scripts/download-icons.mjs`, dari `icon_src` di `data/apps.json`.
4. Hasil ditulis ke `data/apps.json` hanya kalau hash konten berubah
   (timestamp `generated_at`/`scraped_at` tidak dihitung sebagai perubahan).
5. Commit hanya kalau ada diff, lalu Cloudflare Pages auto-deploy dari push ke `main`.

## Menjalankan lokal

```bash
node --version  # >= 20
npm test        # 16 tes
node scripts/scrape.mjs   # fetch live morpheapk.com (±3 menit, 100 aplikasi)
node scripts/build.mjs    # hasil di public/
npx serve public  # atau: python3 -m http.server -d public
```

## Kalau layout Morphe berubah

- Selector terpusat di `scripts/lib/parse-list.mjs` dan `scripts/lib/parse-detail.mjs`.
- Kalau JSON-LD hilang, scraper fallback ke tabel `.ap-info` + kartu daftar.
- Satu aplikasi gagal → dilewati + peringatan di log, job lanjut.
- Kalau `skipped > 5` atau aplikasi valid `< 50`, job keluar dengan kode 2
  (data valid tetap ditulis, tapi kegagalan terlihat di tab Actions).
- Perbaiki selector, tambah fixture di `test/fixtures/`, jalankan `npm test`,
  lalu jalankan workflow manual sekali.

## Struktur

```
.github/workflows/sync.yml  # cron scrape 3x sehari
scripts/scrape.mjs           # orkestrator scrape
scripts/build.mjs            # generator situs statis → public/
scripts/lib/schema.mjs       # skema + normalisasi (ukuran, tanggal, root, slug)
scripts/lib/fetch.mjs        # fetch + retry/backoff
scripts/lib/parse-list.mjs   # parse halaman daftar
scripts/lib/parse-detail.mjs # parse halaman detail
scripts/lib/validate.mjs     # validasi per aplikasi
scripts/lib/render.mjs       # render index + detail
data/apps.json               # data hasil scrape (sumber kebenaran)
public/icons/*.webp          # ikon hasil unduhan build (tidak di-commit)
public/                      # hasil build (index + apps/<slug>/)
docs/superpowers/specs/2026-11-21-morphe-mirror-design.md
docs/superpowers/plans/2026-11-21-morphe-mirror-plan.md
```

## Catatan

APK dibuat pipeline komunitas AutoBuilds, bukan oleh tim Morphe maupun situs ini.
Setiap halaman detail menyertakan catatan itu.

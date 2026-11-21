# Desain: Website Mirror Daftar Aplikasi Morphe — GitHub Actions + Cloudflare Pages

Tanggal: 2026-11-21
Pemilik: Zan
Perancang: Kimi (agen rekomendasi Geraikita, kimi-k3-uncensored) + Muse
Status: Disetujui Zan 21 Nov 2026 pukul 10.02 WIB ("lanjutkan", domain morphe.nazuaf.com) — pembangunan dimulai

## Maksud dan alasan

Zan mau website yang menampilkan daftar aplikasi Android pre-patched Morphe seperti di https://morpheapk.com/apps/, lengkap dengan halaman detail tiap aplikasi, dan isinya ikut berubah otomatis setiap kali situs Morphe update. Link download tidak di-host sendiri, hanya diteruskan ke sumber aslinya.

Alasan memilih mirror daftar (bukan menyalin situs Morphe mentah-mentah): pengunjung Zan dapat satu tempat berbahasa / bertema nazuaf.com untuk melihat aplikasi apa saja yang update, versi berapa, dan kapan — tanpa Zan harus update manual tiap kali.

## Tujuan

1. Halaman daftar menampilkan semua ~100 aplikasi: ikon, nama, kategori, versi, tanggal update terakhir. Ada kotak pencarian/filter seperti di Morphe ("Filter 100 apps...") dan bagian Popular (8 aplikasi: Google Photos, Instagram, Reddit, Telegram, Threads, TikTok, YouTube, YouTube Music).
2. Halaman detail tiap aplikasi menampilkan: nama, versi, tanggal update, kategori, ukuran file, Android minimum, arsitektur, perlu root atau tidak, bundle patch, deskripsi patch, dan tombol "Download APK" yang mengarah ke URL GitLab asli dari Morphe.
3. Sinkronisasi otomatis: kalau Morphe menambah aplikasi baru, menaikkan versi, atau mengubah tanggal/link, website Zan ikut berubah tanpa campur tangan manual, paling lambat dalam satu siklus jadwal sync.
4. Dibangun di GitHub, di-deploy ke Cloudflare Pages. Hanya tier gratis Cloudflare, tanpa fitur berbayar dan tanpa kartu kredit.
5. Tema sama dengan blog nazuaf.com (tema "Nazuaf Alive"): terang, bersih, latar #f7f7f7, kartu putih, tinta #0a0a0a, aksen hitam/abu, font Inter + Plus Jakarta Sans, radius kartu 20px, header minimal hanya logo + tulisan.

## Non-tujuan

- Tidak hosting file APK di GitHub, Pages, R2, atau di mana pun. Tidak mengunggah ulang APK.
- Tidak memodifikasi APK, tidak membuat patch sendiri, tidak menjalankan patcher.
- Tidak membuat akun pengguna, komentar, rating, atau sistem pembayaran.
- Tidak menyalin artikel / panduan Morphe di luar deskripsi patch tiap aplikasi.
- Tidak ada monetisasi / iklan di versi pertama.

## Anti-tujuan (yang membuat ini gagal sekalipun secara teknis jalan)

- Website menampilkan daftar kosong atau halaman error hanya karena satu kali sync gagal.
- Ikon mati massal karena hotlink ke Morphe.
- Link download direkonstruksi dari tebakan pola URL (bisa salah versi) — link harus selalu yang persis hasil scrape halaman detail Morphe.
- Update diam-diam salah baca (misalnya versi tertukar antar aplikasi) tanpa jejak yang bisa diaudit.

## Fakta sumber yang sudah terverifikasi (21 Nov 2026)

- Daftar: https://morpheapk.com/apps/ — 100 aplikasi, tanpa pagination, semua dimuat sekaligus.
- Detail contoh: https://morpheapk.com/morphe-youtube/ — "Morphe YouTube", v21.30.216, 04 Nov 2026, kategori Video Players & Editors, ukuran 140.58 MB, Android 9.0+, arsitektur Universal, Root: Not needed, bundle MorpheApp/morphe-patches 2.0.0.
- Download contoh: https://gitlab.com/api/v4/projects/87288318/packages/generic/morphe-apks/latest/youtube-universal-morphe-v21.30.216.apk — APK dari pipeline komunitas AutoBuilds, bukan dari tim Morphe; link di-refresh beberapa kali sehari.
- Morphe tidak punya API resmi yang terlihat. Sinkronisasi harus scraping HTML — selector adalah kontrak rapuh.
- Ikon di /img/apps/*.webp, contoh: https://morpheapk.com/img/apps/youtube-morphe.webp

## Kendala

- Cloudflare hanya gratis. Pages: build 500/bulan. Workers free tidak dipakai sebagai scraper utama (lihat pendekatan yang dipilih).
- GitHub: repo di akun Ozanxzan. Actions di repo publik gratis; di repo privat ada batas menit — jadi repo disarankan publik.
- Scraping: Morphe bisa mengubah layout, memblokir bot, atau mengubah pola URL GitLab. Scraper harus gagal dengan jelas (job merah), bukan diam-diam menulis data salah.
- Nama/deskripsi patch berbahasa Inggris di sumber. UI situs bisa Bahasa Indonesia, isi aplikasi tetap mengikuti sumber.

## Pendekatan yang dipertimbangkan

### A. GitHub Actions scrape + Pages (auto-deploy dari push) — DIPILIH (rekomendasi Kimi)

Alur: Actions cron 3x sehari (diusulkan 00.00, 08.00, 16.00 WIB) → scraper fetch halaman daftar + 100 halaman detail → parse → tulis data/apps.json + icons/*.webp → kalau ada diff terhadap commit terakhir, commit; kalau tidak ada diff, berhenti tanpa deploy → Pages otomatis rebuild dari push ke main.

Keputusan dari review pembangun (21 Nov 2026): Deploy Hook TIDAK dipakai — satu jalur deploy saja, yaitu auto-deploy Pages dari push, supaya tidak ada build ganda dan tidak butuh secret CLOUDFLARE_PAGES_DEPLOY_HOOK.

Trade-off: update tidak instan (menunggu jadwal berikutnya); ketahanan tertinggi — data ter-version di git, tiap update Morphe terlihat sebagai commit diff dan bisa di-rollback; kalau scrape gagal, situs tetap hidup dengan data kemarin; kegagalan terlihat langsung di tab Actions. Biaya nol, tanpa runtime.

### B. Worker Cron + KV + Pages Functions — ditolak untuk v1

Alur: Worker cron scrape Morphe, simpan ke KV, Pages baca KV saat request. Plus: ada Worker seperti diminta awal, tanpa commit tiap update. Minus: scrape 100 halaman dalam satu Worker rawan kena batas CPU/timeout tier gratis; kalau scrape gagal, pengunjung bisa dapat data kosong/stale tanpa jejak git; data tidak ter-version. Ditolak karena ketahanan lebih rendah dari A untuk kebutuhan ini. Worker tetap bisa ditambahkan belakangan sebagai API kecil (misalnya /api/apps) kalau dibutuhkan — bukan sebagai jalur sync utama.

### C. Lazy / cache-on-demand — dibuang

Sync terjadi saat pengunjung pertama setelah TTL habis. Dibuang: pengunjung pertama menunggu scrape 100 halaman (10-30 detik atau timeout) dan kegagalan Morphe langsung kena di depan pengguna.

## Pendekatan yang dipilih — detail pembangunan

### Repo dan domain (diputuskan Zan 21 Nov 2026)

- Nama repo: `Ozanxzan/nazuaf-apps` (publik — diputuskan sebagai default dari desain karena Actions repo publik gratis; Zan menyetujui dengan "lanjutkan").
- Domain: `morphe.nazuaf.com` (bukan apps.nazuaf.com). V1 dulu di `<project>.pages.dev`, lalu pasang morphe.nazuaf.com setelah terverifikasi.

### Struktur repo

```
nazuaf-apps/
  .github/workflows/sync.yml      # cron scrape 3x sehari + commit + deploy hook
  scripts/scrape.mjs             # scraper Node.js (fetch bawaan, tanpa headless browser)
  scripts/build.mjs              # generator situs statis dari data/apps.json
  data/apps.json                 # data hasil scrape (satu file, jadi sumber kebenaran)
  public/icons/*.webp            # ikon yang disalin saat scrape, bukan hotlink
  public/                        # hasil build: index.html, apps/<slug>/index.html, style.css, app.js
  docs/superpowers/specs/2026-11-21-morphe-mirror-design.md  # dokumen ini
```

### Format data (data/apps.json)

Satu array aplikasi, satu objek per aplikasi:

```json
{
  "slug": "morphe-youtube",
  "name": "Morphe YouTube",
  "version": "v21.30.216",
  "updated": "2026-11-04",
  "category": "Video Players & Editors",
  "size_mb": 140.58,
  "android_min": "9.0",
  "arch": "Universal",
  "root": false,
  "patch_bundle": "MorpheApp/morphe-patches 2.0.0",
  "description": "...teks deskripsi patch dari halaman detail...",
  "icon": "/icons/morphe-youtube.webp",
  "download_url": "https://gitlab.com/api/v4/projects/87288318/packages/generic/morphe-apks/latest/youtube-universal-morphe-v21.30.216.apk",
  "popular": true,
  "source_url": "https://morpheapk.com/morphe-youtube/",
  "scraped_at": "2026-11-21T00:00:00Z"
}
```

Field yang tidak ditemukan di halaman detail boleh null — jangan dikarang. `download_url` selalu URL mentah hasil scrape, jangan direkonstruksi dari versi.

### Scraper (scripts/scrape.mjs)

- Bahasa: Node.js 20, fetch bawaan, parser HTML ringan. Tanpa Puppeteer / headless browser.
- Urutan: fetch halaman daftar dulu, ambil 100 link detail + daftar Popular, lalu fetch tiap halaman detail satu per satu dengan jeda 1-2 detik dan header User-Agent browser biasa.
- Selector HTML dipusatkan di satu file / satu bagian atas scraper supaya kalau layout Morphe berubah, perbaikannya di satu tempat.
- Ikon: unduh file .webp dari Morphe saat pertama kali / saat berubah, simpan ke public/icons/. Jangan hotlink.
- Validasi sebelum commit: jumlah aplikasi valid > 0; tiap aplikasi wajib punya slug, name, version, dan download_url https. Satu aplikasi gagal validasi → aplikasi itu dilewati dengan peringatan di log, job tetap lanjut dengan aplikasi lain (keputusan review pembangun). Hanya gagal total kalau fetch daftar gagal atau 0 aplikasi valid — maka tidak ada commit.
- Validasi host download: baru YouTube yang terbukti gitlab.com. Jadi jangan gagalkan job hanya karena satu aplikasi host-nya bukan gitlab.com — cukup beri peringatan di log dan catat host-nya; pembangun wajib memeriksa semua 100 halaman detail saat membangun dan melaporkan host apa saja yang muncul.
- Ikon: nama file ikon sumber tidak bisa ditebak dari slug (contoh: youtube-morphe.webp untuk slug morphe-youtube) — ikon wajib diambil dari atribut src gambar di halaman daftar/detail saat scrape.
- Selector HTML: belum ada selector final di desain — pembangun wajib memetakan selector live dari HTML Morphe saat membangun (daftar, Popular, dan tiap field detail), dan memusatkannya di satu tempat di scraper.
- Commit hanya kalau ada diff pada data/apps.json atau ikon. Pesan commit: `sync: <n> aplikasi, <n> berubah, <n> baru` + tanggal. Pages rebuild otomatis dari push — tidak ada Deploy Hook.
- Secret yang dibutuhkan di repo: tidak ada. Tidak ada API key Morphe.

### Situs (scripts/build.mjs → public/)

- Situs statis penuh, tanpa framework berat. HTML + CSS + sedikit JS untuk pencarian/filter client-side.
- Halaman utama `/`: hero singkat bergaya nazuaf.com ("Jelajahi teknologi. Pahami lebih dalam." diganti dengan judul untuk direktori aplikasi — teks final di tangan pembangun, tetap bernada blog), bagian Popular, bagian "Semua Aplikasi (100)" dengan kartu per aplikasi, kotak pencarian yang memfilter nama + kategori + deskripsi di browser, dan keterangan "Terakhir diperbarui: <tanggal sync>" + link "Sumber data: morpheapk.com".
- Halaman detail `/apps/<slug>/`: ikon besar, nama, versi, tanggal, kategori, tabel info (ukuran, Android, arsitektur, root, bundle), deskripsi patch, tombol "Download APK" (link langsung ke GitLab asli, target _blank, rel noopener), dan link "Lihat di Morphe" ke source_url.
- Tema: salin token dari tema Nazuaf Alive (style.css): --bg #f7f7f7, --surface #ffffff, --ink #0a0a0a, --muted #525252, --line #e5e5e5, radius 20px / 14px, font Inter + Plus Jakarta Sans, header minimal logo + tulisan, kartu dengan shadow lembut. Tidak perlu menyalin file tema WordPress mentah-mentah — hanya token visualnya.
- Bahasa: UI Bahasa Indonesia; nama aplikasi, kategori, dan deskripsi patch tetap Bahasa Inggris mengikuti sumber (keputusan Muse, bisa dikoreksi Zan).
- Setiap halaman detail menyertakan catatan singkat: APK dibuat pipeline komunitas AutoBuilds, bukan oleh tim Morphe maupun oleh situs ini; unduh dan pasang dengan risiko sendiri.

### Cloudflare Pages

- Project Pages terhubung ke repo GitHub, branch main. Build command menjalankan `node scripts/build.mjs`, output directory `public/` — satu jalur build ini saja, didokumentasikan di README.
- Deploy otomatis dari push ke main. Tidak ada Deploy Hook.
- Custom domain morphe.nazuaf.com ditambahkan setelah v1 terverifikasi di *.pages.dev.

### Jadwal sync

- Cron Actions: 3x sehari, diusulkan pukul 00.00, 08.00, 16.00 WIB. Alasan: Morphe refresh link beberapa kali sehari; 3x sehari menyeimbangkan kesegaran dengan kuota build Pages (maks ~90 build/bulan kalau tiap sync ada perubahan, di bawah batas 500).
- Kalau tidak ada perubahan, tidak ada commit dan tidak ada deploy.

### Yang diserahkan ke pembangun

- Buat repo, workflow, scraper, generator situs, dan Pages project sesuai dokumen ini.
- Verifikasi live: bandingkan 5 aplikasi acak (termasuk YouTube) antara situs baru dan Morphe — versi, tanggal, dan download_url harus sama persis.
- Verifikasi sync: ubah data tiruan / jalankan workflow manual sekali dan pastikan commit + deploy terjadi hanya kalau ada perubahan.
- Tulis README singkat: cara sync bekerja, cara menjalankan scraper lokal, dan apa yang dilakukan kalau layout Morphe berubah.

## Yang diputuskan Zan (21 Nov 2026)

1. Desain disetujui — "lanjutkan".
2. Domain: `morphe.nazuaf.com` (v1 dulu di `<project>.pages.dev`).
3. Nama repo `nazuaf-apps` dan repo publik dipakai sebagai default desain (Zan tidak mengubahnya saat menyetujui).

## Keputusan dari review pembangun (Muse, 21 Nov 2026)

- Jalur build: Pages build (`node scripts/build.mjs`, output `public/`), tanpa Deploy Hook, tanpa secret.
- `build.mjs` tidak boleh menghapus `public/icons/` saat meregenerasi `public/` — ikon adalah data yang di-commit, bukan hasil build.
- Urutan kartu mengikuti urutan sumber; tanggal tampil format "4 Nov 2026"; field null disembunyikan di halaman detail; pencarian memfilter nama + kategori + deskripsi; catatan AutoBuilds/risiko di bawah tombol download di halaman detail.
- Kata-kata hero diserahkan ke pembangun, tetap bernada blog nazuaf.com.
- Parser HTML ringan pilihan pembangun, tanpa headless browser, selector terpusat, jeda 1-2 detik antar request + retry sekali kalau gagal.

## Keputusan Muse (bisa dikoreksi Zan)

- Bahasa UI Indonesia, isi aplikasi Inggris mengikuti sumber.
- Sync 3x sehari (00.00, 08.00, 16.00 WIB).
- Scraper Node.js tanpa headless browser; ikon disalin, bukan hotlink.
- Halaman detail di /apps/<slug>/.

## Perubahan desain saat pembangunan (21 Nov 2026, keputusan Muse)

- Ikon TIDAK di-commit ke repo. Alasan: file biner .webp tidak bisa di-push lewat GitHub MCP (push_files/create_or_update_file hanya menerima konten UTF-8). Sebagai gantinya `data/apps.json` menyimpan `icon_src` per aplikasi, dan `scripts/download-icons.mjs` mengunduh ikon ke `public/icons/<slug>.webp` saat build — baik di Actions maupun di Pages (build command Pages: `node scripts/download-icons.mjs && node scripts/build.mjs`). Perilaku situs tidak berubah: ikon tetap tampil, tetap bukan hotlink.

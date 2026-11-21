# Morphe Mirror Implementation Plan

**Goal:** Website statis mirror daftar aplikasi Morphe di `morphe.nazuaf.com` (v1 `*.pages.dev`), data dari `morpheapk.com`, sinkron otomatis 3x sehari.

**Architecture:** GitHub Actions cron → `scrape.mjs` (fetch daftar → 100 URL kanonis dari JSON-LD ItemList → fetch detail satu-satu, jeda 1-2 detik) → validasi per aplikasi → tulis `data/apps.json` + salin ikon ke `public/icons/` → commit hanya kalau konten berubah (tanpa timestamp) → Pages build `node scripts/build.mjs` → auto-deploy dari push.

**Tech Stack:** Node.js 20 (ESM, `node:test`), `fetch` bawaan, `node-html-parser`, GitHub Actions, Cloudflare Pages, CSS murni (Inter + Plus Jakarta Sans).

**Spec:** `~/workspace/nazuaf-apps/docs/superpowers/specs/2026-11-21-morphe-mirror-design.md` (disetujui Zan 21 Nov 2026, domain morphe.nazuaf.com). Perancang rencana: Kimi (kimi-k3-uncensored). Reviewer: DeepSeek + Qwen (paralel, independen). Verifikasi Muse: temuan yang disepakati kedua reviewer diterapkan di bawah; perbedaan verdict (DeepSeek: perlu revisi besar, Qwen: layak dengan perbaikan) diselesaikan dengan menerapkan semua perbaikan yang disepakati.

## Global Constraints

- Satu aplikasi gagal → skip + `console.warn`, job lanjut; gagal total hanya kalau fetch daftar gagal atau 0 aplikasi valid → exit 1, tanpa commit.
- Host download bukan `gitlab.com` → warn saja, jangan gagalkan job.
- `build.mjs` dilarang menghapus `public/icons/` — dilarang `fs.rm(outDir, {recursive:true})`; tulis file selektif saja.
- Tanpa secret, tanpa Deploy Hook, tanpa hosting APK.
- Parsing berurutan: JSON-LD → tabel `.ap-info` → kartu daftar.
- Jeda fetch: `FETCH_DELAY_MIN_MS=1000`, `FETCH_DELAY_MAX_MS=2000`, acak + jitter per request; hormati header `Retry-After` saat 429. Jeda 300ms dari draf Kimi DITOLAK — bertentangan dengan desain 1-2 detik.
- Cron: `0 17,1,9 * * *` — ini UTC, sama dengan 00.00/08.00/16.00 WIB; tulis komentar itu di workflow. GitHub Actions tidak menjamin cron tepat waktu.
- Ikon dinormalisasi ke `/icons/<slug>.webp`; sumber ikon diambil dari `src` gambar / `data-pagefind-meta=image:` — jangan ditebak dari slug. Ikon hanya ditulis kalau hash/ukuran berubah; kalau fetch ikon gagal, jangan hapus ikon lama, set `icon` ke file lama bila ada, kalau tidak ada set null + warn.
- `generated_at` / `scraped_at` tidak boleh membuat diff kosong jadi commit: bandingkan hash konten aplikasi tanpa timestamp; tulis timestamp hanya kalau konten berubah. Commit sync tidak memicu loop karena workflow hanya `on: schedule + workflow_dispatch`, bukan `on: push`.
- Workflow pakai `concurrency: {group: sync, cancel-in-progress: true}` dan batas total waktu scrape 45 menit — sisanya skip + warn.
- Normalisasi ketat (diuji di T1): ukuran via regex `([\d.,]+)\s*(MB|GB)`, koma desimal Eropa dinormalisasi, GB ×1024 ke MB; tanggal via whitelist bulan Inggris ("04 Nov 2026" → "2026-11-04", "November 4, 2026" juga diterima); root via map eksplisit `{"not needed": false, "required": true, "yes": true, "no": false}`, selain itu null.

## Review Focus

1. HTML sumber berubah — selector/JSON-LD hilang; harus fallback berlapis, bukan crash. Tes: fixture tanpa JSON-LD tetap menghasilkan aplikasi dari tabel + kartu.
2. JSON-LD rusak/absen — parse gagal; fallback tabel + kartu. Tes: fixture JSON-LD rusak.
3. Jaringan/timeout/rate-limit — retry dengan backoff eksponensial, hormati Retry-After, batas total 45 menit. Tes: stub fetch selalu reject → throw setelah attempts = retries+1.
4. Data kotor — ukuran, tanggal, root seperti di atas. Tes: unit normalisasi di T1.
5. Tidak ada perubahan — jangan commit kosong, jangan deploy ulang; `scraped_at`/`generated_at` tidak dihitung sebagai perubahan. Tes: run kedua tanpa perubahan data → tidak ada commit baru.
6. Alarm sync — kalau `skipped > 5` atau `apps.length < 50`, tulis error terstruktur + exit 2 (bukan exit 1), agar kegagalan sebagian terlihat tanpa menghapus data lama.

## Tugas

### Task 1: Scaffold & skema data + normalisasi + slug
**Files:**
- Create: `package.json`, `data/apps.json`, `scripts/lib/schema.mjs`
- Test: `test/schema.test.mjs`
**Interfaces:**
- Consumes: —
- Produces: `normalizeApp(raw: object): object`, `parseSizeMb(s: string): number|null`, `parseDateId(s: string): string|null` (YYYY-MM-DD), `parseRoot(s: string): boolean|null`, `slugFromUrl(url: string): string`, `APPS_SCHEMA_KEYS: string[]`, `writeAppsJson(apps: object[], generatedAt: string): string` (mengembalikan isi file; hanya dipanggil kalau hash konten berubah)
- [ ] **Step 1: Tulis tes yang gagal** — `normalizeApp({slug:'x'}).version === null`; `parseSizeMb('140.58 MB') === 140.58`; `parseSizeMb('1,2 GB') === 1228.8`; `parseDateId('04 Nov 2026') === '2026-11-04'`; `parseRoot('Not needed') === false`; `slugFromUrl('https://morpheapk.com/morphe-youtube/') === 'morphe-youtube'` (juga tanpa trailing slash dan dengan query).
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Perintah: `node --test test/schema.test.mjs` — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan fungsi-fungsi di atas di `scripts/lib/schema.mjs`**
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Perintah: `node --test test/schema.test.mjs` — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 2: Fetch berlapis
**Files:**
- Create: `scripts/lib/fetch.mjs`
- Test: `test/fetch.test.mjs`
**Interfaces:**
- Consumes: —
- Produces: `fetchHtml(url: string, opts?: {retries?: number, timeoutMs?: number, backoffMs?: number}): Promise<string>` — `retries` = jumlah percobaan ulang SETELAH percobaan awal (total percobaan = retries+1); backoff eksponensial, hormati `Retry-After`.
- [ ] **Step 1: Tulis tes yang gagal** — stub `globalThis.fetch` selalu reject: `await assert.rejects(fetchHtml('https://x', {retries: 3}), /fetch failed after 4/)` dan jumlah pemanggilan stub === 4.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — `node --test test/fetch.test.mjs` — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `fetchHtml` di `scripts/lib/fetch.mjs`** (AbortController + timeout, backoff 1s/2s/4s).
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 3: Parse daftar
**Files:**
- Create: `scripts/lib/parse-list.mjs`, `test/fixtures/apps-list.html` (salinan potongan HTML live, 2-3 kartu + JSON-LD ItemList)
- Test: `test/parse-list.test.mjs`
**Interfaces:**
- Consumes: `slugFromUrl` dari Task 1.
- Produces: `parseAppList(html: string): {urls: string[], cards: Record<string, {iconSrc: string, category: string, version: string, date: string}>}` — kunci cards adalah slug dari `slugFromUrl`; `popular` dikembalikan terpisah sebagai `popularSlugs: string[]` dari `.apps-popular-item`.
- [ ] **Step 1: Tulis tes yang gagal** — `parseAppList` fixture: `urls.length === 100` pada HTML penuh (atau jumlah fixture bila dipotong), semua URL berawalan `https://morpheapk.com/morphe-`; `cards['morphe-youtube'].iconSrc === '/img/apps/youtube-morphe.webp'`; fallback: HTML tanpa JSON-LD tetap menghasilkan URL dari `.apps-row`.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `parseAppList` di `scripts/lib/parse-list.mjs`** — utamakan JSON-LD ItemList, fallback `.apps-row`.
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 4: Parse detail
**Files:**
- Create: `scripts/lib/parse-detail.mjs`, `test/fixtures/detail-youtube.html`
- Test: `test/parse-detail.test.mjs`
**Interfaces:**
- Consumes: `parseSizeMb`, `parseDateId`, `parseRoot`, `slugFromUrl` dari Task 1.
- Produces: `parseAppDetail(html: string, sourceUrl: string): object` — field sesuai Spec; `icon` dinormalisasi ke `/icons/<slug>.webp`; `download_url` = href tombol `.ap-dl` bila ada, kalau berbeda dari `downloadUrl` JSON-LD beri `warnings` dan pakai href tombol.
- [ ] **Step 1: Tulis tes yang gagal** — fixture YouTube: `version === '21.30.216'`, `size_mb === 140.58`, `updated === '2026-11-04'`, `root === false`, `arch === 'Universal'`, `download_url` match `/^https:\/\/gitlab\.com\/api\/v4\/projects\/87288318/`, `icon === '/icons/morphe-youtube.webp'`, `category === 'Video Players & Editors'`, `patch_bundle === '2.0.0'`; fixture tanpa JSON-LD tetap lolos dari tabel `.ap-info`.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `parseAppDetail` di `scripts/lib/parse-detail.mjs`** — JSON-LD utama, `.ap-info` silang, `data-pagefind-meta="image:` untuk ikon sumber, `article.ap-about` → `description_html`.
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 5: Validasi
**Files:**
- Create: `scripts/lib/validate.mjs`
- Test: `test/validate.test.mjs`
**Interfaces:**
- Consumes: —
- Produces: `validateApp(app: object): {ok: boolean, errors: string[], warnings: string[]}` — wajib: slug, name, version, download_url https; host bukan gitlab.com → `warnings`, `ok` tetap true.
- [ ] **Step 1: Tulis tes yang gagal** — `validateApp({...base, download_url: null}).ok === false`; `validateApp({...base, download_url: 'https://example.com/x.apk'}).ok === true` dan `warnings.length >= 1`.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `validateApp` di `scripts/lib/validate.mjs`**
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 6: Orkestrator scrape + unduh ikon
**Files:**
- Create: `scripts/scrape.mjs`
- Test: `test/scrape.test.mjs`
**Interfaces:**
- Consumes: Task 2–5, `writeAppsJson` dari Task 1.
- Produces: `runScrape(deps): Promise<{apps: object[], skipped: number}>` — urutan: fetch daftar → parse daftar → fetch detail satu-satu dengan jeda 1000–2000ms acak → parse + validasi → unduh ikon ke `public/icons/<slug>.webp` hanya kalau hash berubah (gagal fetch ikon → pertahankan file lama, warn) → tulis `data/apps.json` hanya kalau hash konten berubah → kalau `skipped > 5` atau `apps.length < 50`, log error terstruktur dan exit 2; kalau 0 aplikasi valid atau fetch daftar gagal, exit 1 tanpa commit.
- [ ] **Step 1: Tulis tes yang gagal** — dua URL stub, satu detail kosong → `apps.length === 1`, `skipped === 1`; `apps[0].description_html` non-null; `apps[0].scraped_at` match `/^\d{4}-\d{2}-\d{2}T/`; `popular` dari kartu ter-merge; bentuk file akhir `{"apps": [...], "generated_at": ...}` lewat `writeAppsJson` round-trip.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `runScrape` di `scripts/scrape.mjs`** — batas total 45 menit, sisanya skip + warn.
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 7: Build situs
**Files:**
- Create: `scripts/build.mjs`, `scripts/lib/render.mjs`, `public/assets/style.css`
- Test: `test/build.test.mjs`
**Interfaces:**
- Consumes: `data/apps.json` dari Task 6.
- Produces: `renderIndex(apps: object[]): string`, `renderDetail(app: object): string`, `buildSite(opts: {dataPath: string, outDir: string}): Promise<void>` — menulis `public/index.html` dan `public/apps/<slug>/index.html`, TIDAK menyentuh `public/icons/`.
- [ ] **Step 1: Tulis tes yang gagal** — tulis `public/icons/keep.webp`, jalankan build, `keep.webp` masih ada dan tidak kosong; build dengan folder ikon kosong tidak crash; index berisi kotak `<input id="q">` dan teks "Terakhir diperbarui"; detail berisi tombol `target="_blank" rel="noopener"` ke download_url dan tanggal "4 Nov 2026" untuk updated 2026-11-04.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Implementasikan `renderIndex`, `renderDetail`, `buildSite`** — hero bernada blog, Popular, grid Semua Aplikasi + filter client-side (nama+kategori+deskripsi), link sumber morpheapk.com, catatan AutoBuilds di bawah tombol download.
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 8: Workflow + README + Pages
**Files:**
- Create: `.github/workflows/sync.yml`
- Modify: `README.md`
**Interfaces:**
- Consumes: Task 6–7.
- Produces: workflow `on: schedule (cron '0 17,1,9 * * *' # UTC = 00.00/08.00/16.00 WIB) + workflow_dispatch`, `concurrency: {group: sync, cancel-in-progress: true}`, langkah: checkout, setup-node 20, `node scripts/scrape.mjs`, `node scripts/build.mjs`, `git diff --quiet data/ public/icons/ || (commit + push)`; README menjelaskan cara sync bekerja, cara jalan lokal, dan apa yang dilakukan kalau layout Morphe berubah. Project Cloudflare Pages: terhubung ke repo, branch main, build `node scripts/build.mjs`, output `public/`, auto-deploy dari push.
- [ ] **Step 1: Tulis tes yang gagal** — skrip cek YAML: cron berisi `0 17,1,9 * * *` + komentar UTC/WIB, ada `workflow_dispatch`, ada `concurrency`.
- [ ] **Step 2: Jalankan tes untuk memastikan ia gagal** — Diharapkan: FAIL.
- [ ] **Step 3: Tulis workflow + README**
- [ ] **Step 4: Jalankan tes untuk memastikan ia lolos** — Diharapkan: PASS.
- [ ] **Step 5: Commit**

### Task 9: Verifikasi akhir
**Files:**
- Create: `docs/verification.md`
**Interfaces:**
- Consumes: Task 1–8.
- Produces: laporan verifikasi dengan URL live, tanggal, dan hasil perbandingan.
- [ ] **Step 1: Tulis prosedur verifikasi** — ambil 5 slug acak + `morphe-youtube`, bandingkan `version`, `updated`, `download_url` dengan sumber live; jalankan `gh workflow run sync.yml` (workflow_dispatch), cek `gh run list` + commit baru; jalankan kedua kali tanpa perubahan data, pastikan tidak ada commit baru; cek deployment Pages dan situs live `*.pages.dev` (ikon termuat, tombol ke GitLab asli).
- [ ] **Step 2: Jalankan verifikasi dan catat hasilnya di `docs/verification.md`**
- [ ] **Step 3: Pasang custom domain `morphe.nazuaf.com` setelah v1 live terverifikasi, dan verifikasi ulang lewat domain itu.**
- [ ] **Step 4: Commit hasil verifikasi**

## Self-review (Muse, terhadap Spec)

- Cakupan Spec: daftar + detail + pencarian + Popular + sync 3x + tema + tanpa APK + tanpa secret — semua punya tugas (T3/T4 daftar+detail, T7 pencarian/Popular/tema, T6/T8 sync, T9 verifikasi).
- Konsistensi tipe: `slugFromUrl` didefinisikan di T1 dan dipakai T3/T4/T6; `icon` selalu `/icons/<slug>.webp` (T4/T6/T7); `data/apps.json` selalu `{"apps": [...], "generated_at": ...}` via `writeAppsJson` (T1/T6/T7).
- Review Focus: tiap kelas punya tes (fallback JSON-LD di T3/T4, retry di T2, normalisasi di T1, no-op di T6/T9, alarm skipped di T6).
- Proporsi: rencana ini lebih ringkas dari draf Kimi karena badan fungsi diganti signature + tes; keputusan yang diubah dari draf Kimi dicatat di Global Constraints.

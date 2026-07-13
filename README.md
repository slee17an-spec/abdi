# Bisikan Sufi

**Bisikan Sufi** adalah Progressive Web App (PWA) spiritual berbahasa Indonesia yang dirancang sebagai ruang hening digital. Aplikasi berjalan langsung di browser, dapat dipasang ke perangkat, tetap berguna saat offline, dan tidak memerlukan akun.

## Fitur utama

- Renungan harian deterministik dan koleksi 36 renungan orisinal
- Pencarian, filter kategori, favorit, salin, bagikan, dan ekspor kartu PNG
- Latihan napas terpandu 1, 3, 5, atau 10 menit
- Penghitung rangkaian hari latihan yang tersimpan secara lokal
- Tiga suara ambient yang dibuat langsung melalui Web Audio API
- Jurnal harian privat dengan autosave dan ekspor TXT
- Tema gelap/terang, mode pengurangan animasi, navigasi keyboard, dan desain responsif
- PWA offline melalui service worker dan web app manifest
- SEO dasar: metadata, Open Graph, JSON-LD, canonical URL, sitemap, dan robots.txt
- Tidak memakai framework, iklan, analytics, cookie pelacak, atau layanan pihak ketiga

## Struktur

```text
.
├── index.html
├── about.html
├── 404.html
├── css/style.css
├── js/script.js
├── assets/
│   ├── icon.svg
│   └── quotes.json
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
└── .github/workflows/static-checks.yml
```

## Menjalankan secara lokal

Service worker membutuhkan HTTP/HTTPS. Jalankan salah satu server lokal berikut dari root repositori:

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy ke GitHub Pages

1. Buka **Settings → Pages** pada repositori.
2. Pilih **Deploy from a branch**.
3. Pilih branch `main` dan folder `/ (root)`.
4. Simpan. Situs akan tersedia di `https://slee17an-spec.github.io/abdi/`.

## Privasi

Data berikut hanya disimpan di `localStorage` browser pengguna:

- jurnal harian;
- daftar renungan favorit;
- tema dan preferensi animasi;
- tanggal penyelesaian latihan napas.

Tidak ada data yang dikirim ke server oleh aplikasi ini.

## Catatan isi

Renungan di dalam aplikasi merupakan tulisan orisinal untuk refleksi umum. Renungan tidak diklaim sebagai kutipan tokoh tertentu dan bukan pengganti bimbingan agama, psikologis, atau medis profesional.

## Pengembangan

Validasi otomatis di GitHub Actions memeriksa sintaks JavaScript, JSON, manifest, XML, dan referensi aset utama. Untuk perubahan besar, gunakan branch fitur dan pull request.

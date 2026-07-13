# Bisikan Sufi

**Bisikan Sufi** adalah Progressive Web App (PWA) spiritual berbahasa Indonesia yang dirancang sebagai ruang hening digital. Aplikasi berjalan langsung di browser, dapat dipasang ke perangkat, tetap berguna saat offline, dan tidak memerlukan akun maupun API eksternal.

## Fitur utama

- Generator renungan lokal dengan puluhan ribu kemungkinan kombinasi terkurasi
- Renungan harian deterministik yang konsisten berdasarkan tanggal
- Aliran renungan baru per batch tanpa mengambil koleksi JSON tetap
- Pencarian, filter kategori, favorit, salin, bagikan, dan ekspor kartu PNG
- Favorit menyimpan isi renungan lengkap di perangkat agar dapat dibuka kembali
- Latihan napas terpandu 1, 3, 5, atau 10 menit
- Penghitung rangkaian hari latihan yang tersimpan secara lokal
- Tiga suara ambient yang dibuat langsung melalui Web Audio API
- Jurnal harian privat dengan autosave dan ekspor TXT
- Tema gelap/terang, mode pengurangan animasi, navigasi keyboard, dan desain responsif
- PWA offline melalui service worker dan web app manifest
- SEO dasar: metadata, Open Graph, JSON-LD, canonical URL, sitemap, dan robots.txt
- Tidak memakai framework, iklan, analytics, cookie pelacak, OpenAI API, atau layanan pihak ketiga

## Cara kerja generator

Renungan dibuat langsung oleh JavaScript dari bank bahasa terkurasi yang dibagi ke dalam tema seperti Hening, Sabar, Pemulihan, Syukur, Kehadiran, Tawakal, Doa, Ikhlas, Harapan, dan Amal. Setiap hasil menggabungkan pembuka, pendalaman, penutup, dan pola kalimat yang berbeda.

Generator tidak mengambil daftar renungan dari server atau berkas koleksi. Renungan yang muncul selama sesi hanya berada di memori browser. Hanya renungan yang ditandai sebagai favorit yang disimpan ke `localStorage`.

Sistem ini bukan model AI generatif, tetapi memberikan aliran konten yang sangat besar, cepat, privat, gratis, dan tetap berfungsi offline.

## Struktur

```text
.
├── index.html
├── about.html
├── 404.html
├── css/
│   ├── style.css
│   ├── theme.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── script.js
│   ├── app.js
│   ├── wellbeing.js
│   ├── reflection-bank.js
│   ├── reflection-bank-a.js
│   └── reflection-bank-b.js
├── assets/icon.svg
├── manifest.webmanifest
├── sw.js
├── robots.txt
├── sitemap.xml
└── .github/workflows/static-checks.yml
```

`js/script.js` hanya bertindak sebagai bootstrap ringan untuk memuat aplikasi modular dari `js/app.js`.

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
- isi renungan favorit;
- tema dan preferensi animasi;
- tanggal penyelesaian latihan napas.

Tidak ada data yang dikirim ke server oleh aplikasi ini.

## Catatan isi

Renungan merupakan rangkaian teks orisinal untuk refleksi umum. Renungan tidak diklaim sebagai kutipan tokoh tertentu dan bukan pengganti bimbingan agama, psikologis, atau medis profesional.

## Pengembangan

Validasi otomatis di GitHub Actions memeriksa sintaks JavaScript, manifest JSON, struktur HTML/XML, keseimbangan kurung CSS, generator lokal, dan referensi aset utama. Untuk perubahan besar, gunakan branch fitur dan pull request.

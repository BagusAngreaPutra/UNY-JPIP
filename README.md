# JPIP lokal

Di Windows, klik dua kali `start-site.cmd`. Pembuka ini menjalankan situs di `http://127.0.0.1:8765/index.html` dan membuka browser.

Tombol **PDF** pada daftar artikel membuka halaman pembaca lokal. Tombol **Download** pada halaman pembaca menyimpan PDF ke folder unduhan browser. Situs ini tetap menggunakan semua PDF, gambar, ikon, dan stylesheet dari folder proyek.

Arsip, detail 275 artikel, pencarian judul/penulis/kata kunci, template naskah, serta ekspor sitasi RIS/BibTeX dan pilihan gaya sitasi tersedia secara lokal. Login, pendaftaran, dan pengiriman naskah tetap membuka sistem jurnal resmi karena memerlukan akun dan layanan OJS.

Jika `index.html` dibuka langsung sebagai `file://`, browser dapat menampilkan PDF alih-alih mengunduhnya. Gunakan `start-site.cmd` untuk mengaktifkan unduhan.

Untuk memperbarui salinan dari situs jurnal resmi, jalankan `node update-site.mjs`. Pemeriksaan lokal: `node check-links.mjs`, `node check-assets.mjs`, `node check-downloads.mjs`, dan `node check-citations.mjs`.

Untuk memperbarui Vol. 19 No. 2 (2026) beserta detail artikel, PDF, sitasi, dan indeks pencarian lokal, jalankan `node update-site.mjs --issue 3133`. Opsi `--issue` menerima ID edisi dari URL jurnal resmi.

Lima artikel tambahan halaman 221–281 tercatat di `local-articles.json` dan dipasang kembali oleh pembaru situs. Simpan PDF sumber di folder proyek. Untuk menerapkan ulang tambahan lokal tanpa mengunduh situs, jalankan `node apply-local-articles.mjs`, lalu `node build-pdf-viewers.mjs` dan `node build-search.mjs`.

Halaman detail tambahan mengikuti template artikel `99022`, termasuk referensi, panel informasi, lisensi, dan pilihan sitasi. Jalankan `npm ci` jika dependensi pembaru belum terpasang. Sitasi dihasilkan secara lokal dengan `citeproc` dan berkas CSL di `assets/csl`; situs yang sudah dihasilkan tetap dapat dibaca tanpa proses tersebut. Tahun publikasi yang belum memiliki tanggal lengkap disimpan dengan presisi tahun dan dicocokkan sebagai rentang tahun pada filter Search.

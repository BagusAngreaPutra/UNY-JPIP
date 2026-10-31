# Deploy JPIP lewat Git Version Control cPanel

Situs yang sudah dihasilkan berjalan di Apache/cPanel dengan PHP dan mod_rewrite.
PHP menampilkan halaman HTML yang sudah ada melalui jalur jurnal dan menyesuaikan
alamat navigasi saat respons dikirim. File HTML sumber tidak perlu diubah.
Tidak perlu Node.js,
npm install, build, database, atau instalasi OJS di hosting. HTML, CSS, JavaScript,
gambar, PDF, dokumen, pencarian, dan sitasi dipertahankan seperti versi lokal.
Login, registrasi, pengiriman naskah, dan tautan eksternal tetap menuju layanan
yang sudah tercantum di halaman.

## Domain journal.uny-ip.site

Alamat home: `https://journal.uny-ip.site/index.php/jpip`.
Root domain, `index.html`, dan `index.php` diarahkan ke jalur tersebut (302).
Halaman HTML lama lainnya juga diarahkan ke URL jurnal masing-masing (302).
Query string seperti `?utm_source=google` tetap diteruskan. Parameter
`?utm_source` tanpa nilai juga dapat dipakai, tetapi tidak dibutuhkan untuk home.
Setiap halaman dibaca dari HTML sumbernya, dengan base URL otomatis agar CSS,
gambar, skrip, dan PDF tetap memakai lokasi file yang sama, termasuk pada subfolder.
Link navigasi dan action form Search menggunakan jalur jurnal. Hasil Search yang
dibuat JavaScript tetap dapat dibuka lewat pengalihan URL HTML lama. Login,
registrasi, submission, serta layanan lain yang tidak tersedia lokal tetap memakai
layanan eksternal yang sudah tercantum di halaman.

| Halaman | Jalur setelah `https://journal.uny-ip.site` |
| --- | --- |
| Home | `/index.php/jpip` |
| About | `/index.php/jpip/about` |
| Current | `/index.php/jpip/issue/current` |
| Archives | `/index.php/jpip/issue/archive` |
| Edisi | `/index.php/jpip/issue/view/3133` |
| Artikel | `/index.php/jpip/article/view/100745` |
| Pembaca PDF | `/index.php/jpip/article/view/100745/26013` |
| Download PDF | `/index.php/jpip/article/download/100745/26013` |
| Search | `/index.php/jpip/search` |
| Announcements | `/index.php/jpip/announcement` |
| Editorial Team | `/index.php/jpip/about/editorialTeam` |
| Contact | `/index.php/jpip/about/contact` |
| Privacy | `/index.php/jpip/about/privacy` |
| Submissions (informasi) | `/index.php/jpip/about/submissions` |
| Author Guidelines | `/index.php/jpip/Author-guidelines` |
| Readers / Authors / Librarians | `/index.php/jpip/information/readers` (atau `authors`, `librarians`) |

Halaman kebijakan lain memakai slug yang sama dengan sumbernya, misalnya
`/index.php/jpip/author-fees`, `/index.php/jpip/publication-ethics`, dan
`/index.php/jpip/ai-policy`. ID edisi, artikel, dan galley pada tabel hanyalah contoh;
semua ID dengan file lokal yang tersedia dilayani. Jalur/ID yang tidak ada memberi
HTTP 404. File aset, DOCX, dan sitasi tetap berada di lokasi statisnya.

Pengaturan hosting:

1. Di **cPanel > Domains**, tambahkan `journal.uny-ip.site` jika belum tersedia.
   Domain ini adalah subdomain dari `uny-ip.site`; tidak perlu menambah `journal`
   lagi di depannya.
2. Cocokkan **Document Root** domain dengan target `.cpanel.yml`. Default proyek
   tetap `$HOME/public_html`. Jika cPanel menetapkan folder khusus, ubah target
   deployment sesuai folder itu sebelum commit/push.
3. Di penyedia DNS yang aktif untuk `uny-ip.site`, arahkan record **A** bernama
   `journal` ke **IP hosting cPanel**. Ambil IP dari informasi akun hosting;
   jangan memakai IP situs UNY lama. Jika nameserver dikelola hosting, record
   dapat dikelola melalui Zone Editor cPanel.
4. Setelah DNS mengarah ke hosting, pastikan sertifikat SSL untuk
   `journal.uny-ip.site` sudah terpasang melalui AutoSSL/layanan SSL hosting.
   Aktifkan **Force HTTPS Redirect** di cPanel setelah sertifikat aktif.
5. Deploy dari Git dan buka alamat home di atas. DNS dan SSL tidak diubah oleh
   file proyek ini.

## Data yang diisi di cPanel

| Kolom | Nilai |
| --- | --- |
| Clone a Repository | Aktif/ON |
| Clone URL | `https://github.com/BagusAngreaPutra/UNY-JPIP.git` |
| Repository Path | `/home/USERNAME_CPANEL/repositories/UNY-JPIP` |
| Repository Name | `UNY-JPIP` |
| Branch untuk deployment | `main` |
| Document root default | `$HOME/public_html` |

Ganti `USERNAME_CPANEL` dengan username hosting. Gunakan home directory sebenarnya
jika hosting memakai lokasi selain `/home`. Repository Path adalah lokasi checkout
Git, sedangkan document root adalah folder yang dilayani domain.

`.cpanel.yml` memakai `$HOME/public_html`, sehingga username tidak perlu ditulis
di dalam file. Untuk addon domain atau subfolder, cocokkan dengan **cPanel > Domains >
Document Root**, lalu ubah argumen di `.cpanel.yml`, contoh:

```yaml
---
deployment:
  tasks:
    - /bin/bash deploy/cpanel.sh "$HOME/public_html/jpip"
```

Untuk contoh tersebut, situs diakses lewat `https://DOMAIN/jpip/`. URL relatif tetap
berfungsi. Pastikan target merupakan folder yang memang disiapkan untuk situs ini:
deployment memperbarui file bernama sama, termasuk `.htaccess`, tanpa menghapus
file lain di hosting. Deployment juga tidak membersihkan file lama yang kemudian
dihapus dari repository.

## Kirim konfigurasi dari komputer ke GitHub

Jalankan dari folder proyek setelah memeriksa `git diff`:

```powershell
git add .cpanel.yml .htaccess .gitattributes index.php deploy/cpanel.sh CPANEL-DEPLOY.md README.md
git commit -m "Prepare static site deployment for cPanel"
git push origin main
```

File konfigurasi harus sudah di-commit dan di-push sebelum cPanel melakukan clone
atau Update from Remote. URL di atas adalah remote yang terpasang di proyek;
akses dan isi terbaru di GitHub perlu sesuai akun Anda.

## Pasang dan perbarui

1. Buka **cPanel > Git Version Control > Create** dan isi tabel di atas.
2. Klik **Create**, lalu **Manage** pada repository tersebut. Pastikan branch `main`.
3. Buka **Pull or Deploy**, klik **Update from Remote**, lalu **Deploy HEAD Commit**.
4. Buka domain dan cek Home, Archives, artikel, Search, PDF, Download, dan sitasi.
5. Untuk pembaruan berikutnya: commit dan push dari komputer, lalu ulangi
   **Update from Remote > Deploy HEAD Commit** di cPanel.

Jika repository privat, siapkan SSH key hosting yang diberi akses ke repository,
lalu gunakan Clone URL `git@github.com:BagusAngreaPutra/UNY-JPIP.git`. Jangan menaruh
password/token dalam URL. Jika fitur deployment tidak tersedia, periksa dukungan
Git/shell access pada paket hosting, file `.cpanel.yml` yang sudah committed,
branch, dan working tree cPanel yang bersih.

## File yang diterbitkan

- Root: semua `.html`, PDF sumber di root, `index.php`, `search-local.js`,
  `search-data.js`, dan `.htaccess`.
- Folder: `articles`, `assets`, `citations`, `documents`, `issues`, `pdfs`, `viewers`.
- Skrip pemeliharaan, `node_modules`, `.git`, arsip ZIP, dan file kerja tidak disalin.

Pemeliharaan konten tetap dilakukan di komputer dengan alat yang dijelaskan di
README. Tidak ada proses pembaruan dari situs sumber selama deployment.

Rujukan: [Git Version Control](https://docs.cpanel.net/cpanel/files/git-version-control/)
dan [Guide to Git — Deployment](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/).

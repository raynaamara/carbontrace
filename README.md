# CarbonTrace

Aplikasi analisis dan pencatatan material dengan model AI lokal untuk botol PET, kardus, dan papan gipsum berlapis kertas (drywall), konfirmasi pengguna, berat manual, dan faktor emisi bersumber. Classifier dilatih pada dataset pengguna; tidak ada prediksi contoh, berat bawaan, atau faktor karbon buatan pada alur aktif. AI bukan identifikasi kimia atau pemeriksaan bahaya material.

## Menjalankan

Gunakan Node.js 22.18 atau lebih baru (direkomendasikan Node.js 24).

```powershell
npm install
npm run dev
```

Buka http://127.0.0.1:5173. Server hanya mendengarkan koneksi lokal.

```powershell
npm test
npm run build
npm run preview
```

Preview hasil build tersedia di http://127.0.0.1:4173.

## Shared hosting Apache / cPanel

Jalankan `npm run build`, lalu unggah seluruh isi folder hasil build ke Document Root domain/subdomain, bukan seluruh proyek atau satu folder tambahan bernama dist. Halaman utama, favicon, folder assets, dan folder models harus berada langsung di Document Root.

[Konfigurasi Apache](public/.htaccess) ikut disalin Vite menjadi `.htaccess` di akar hasil build:

```apache
DirectoryIndex index.html
Options -Indexes
```

Konfigurasi ini memilih halaman utama dan menonaktifkan daftar isi direktori. Menu aplikasi memakai hash URL, sehingga tidak memerlukan aturan rewrite SPA.

Jika alamat utama menampilkan "Index of /" tetapi akses langsung ke index.html berhasil, pastikan `.htaccess` tersebut berada di Document Root yang sama. Aktifkan tampilan hidden files/dotfiles pada File Manager cPanel. Jika server sudah memiliki `.htaccess`, gabungkan arahan yang diperlukan tanpa menimpa konfigurasi SSL atau aturan lain. Pastikan dotfile ikut masuk arsip unggahan; hapus arsip ZIP dari folder publik setelah ekstraksi.

Aktifkan sertifikat SSL yang valid untuk nama subdomain sebelum memaksakan pengalihan HTTP ke HTTPS. Analisis sidik foto serta penyimpanan unggahan memerlukan HTTPS atau localhost. Data browser pada localhost, HTTP, dan HTTPS berada pada origin berbeda; simpan CSV dan foto asli sebelum berpindah alamat. Hosting ini hanya menyajikan aplikasi/model; catatan dan foto unggahan tetap lokal pada browser, bukan database server.

## Pilihan bahasa

Pemilih **Bahasa / Language** di bagian atas menyediakan **Bahasa Indonesia** (bawaan) dan **English**. Pilihan disimpan pada browser dengan key `carbontrace.language.v1`. Bahasa berubah langsung tanpa memuat ulang halaman, mengganti foto, menghapus hasil AI, atau mengisi ulang draft berat dan parameter khusus.

- Navigasi, label, petunjuk, validasi, pesan penyimpanan/AI, dialog, katalog, arsip, dan penjelasan parameter WARM/PLACES memiliki tampilan kedua bahasa.
- Angka, persentase, dan tanggal menggunakan `id-ID` atau `en-US`. Input desimal tetap menerima koma maupun titik tanpa pemisah ribuan.
- ID material/sampel, nilai numerik, bobot model, metadata inferensi, dan snapshot faktor tidak berubah. Nama rujukan versi r1 tetap disimpan dalam bentuk kanonis; terjemahan hanya untuk tampilan.
- Pada Parameter emisi, isian bawaan dari rujukan (nama kedua skenario, judul sumber, serta konteks/batas sistem) mengikuti bahasa antarmuka, termasuk saat dimuat ke Parameter khusus. Pergantian bahasa hanya memperbarui isian bawaan yang belum diedit; teks yang diketik pengguna, isian kosong yang sengaja dihapus, angka, dan tautan draft tetap dipertahankan. Teks parameter khusus tersimpan tidak diterjemahkan berdasarkan kemiripannya dengan rujukan.
- Teks yang ditulis pengguna dan dokumen sumber tidak diterjemahkan otomatis. CSV mempertahankan kode kolom, nama, dan sumber aslinya agar data penelitian tetap konsisten. Pesan teknis browser/library yang tidak dimiliki aplikasi mempertahankan detail aslinya di dalam konteks pesan yang diterjemahkan.
- Panduan Word dan Markdown unduhan masih berbahasa Indonesia; label unduh pada antarmuka Inggris menyebutkan bahasanya. Laporan pelatihan JSON tetap merupakan data sumber asli.
- Kegagalan membaca preferensi ditampilkan dan memakai bahasa Indonesia tanpa menimpa data. Jika pilihan bahasa tidak dapat disimpan, bahasa sebelumnya tetap aktif dan kesalahannya diberitahukan.

English: use **Bahasa / Language** at the top to choose **English**. Switching languages preserves unsaved inputs and AI results. User-authored text, research exports, source documents, and the Indonesian downloadable guides retain their original wording.

## Warna tema

Pemilih **Warna tema / Theme colour** di bagian atas menyediakan lima tema terang: **Hijau / Green** (bawaan), **Biru / Blue**, **Ungu / Purple**, **Toska / Teal**, dan **Jingga / Orange**. Tema mengubah warna aksen, latar, teks, border, serta fokus kontrol secara konsisten. Warna semantik peringatan/kesalahan dan pembeda material tetap dipertahankan agar maknanya tidak berubah.

Preferensi disimpan terpisah pada `carbontrace.theme.v1`; mengganti tema tidak memuat ulang halaman atau mengubah bahasa, foto, draft, hasil AI, catatan, maupun parameter emisi. Warna metadata browser ikut menyesuaikan. Jika pembacaan preferensi gagal atau tidak valid, kesalahan ditampilkan dan hijau digunakan tanpa menimpa data. Jika penyimpanan gagal, tema sebelumnya tetap aktif.

Palet tambahan memiliki token lengkap dan tes kontras: teks putih tombol utama minimal 4,5:1, dengan pemeriksaan teks, tautan, dan indikator fokus. Nilai hijau lama menjadi fallback agar tampilan bawaan tetap terjaga; ini bukan klaim audit aksesibilitas menyeluruh.

English: choose **Theme colour** at the top. The selection is saved in this browser independently of language and research records. All five options are light themes.

## Menu dan alur terpandu

Menu sekarang membuka **satu tampilan pada satu waktu**, bukan menggulir seluruh halaman panjang. URL lama tetap digunakan agar deep link tetap bekerja:

| Menu | Fungsi |
|---|---|
| Ringkasan (`#overview`) | Pengantar masalah dan manfaat CarbonTrace, ajakan mencoba foto, diagram alur empat langkah, statistik, dan komposisi massa. |
| Catat material (`#workspace`) | Formulir empat langkah: Foto & AI, Material & berat, Tinjau estimasi, Simpan. |
| Riwayat & ekspor (`#records`) | Tinjau, cari/filter, ubah, hapus, dan ekspor seluruh catatan; arsip contoh terpisah. |
| Parameter emisi (`#factor-settings`) | Pilih/terapkan rujukan atau buka Parameter khusus (lanjutan). |
| Panduan & uji AI (`#methodology`) | Panduan singkat, pintasan unggah di Catat material, dataset/laporan model, serta metode dan batas klaim. |

Pengantar Ringkasan menjelaskan mengapa catatan material dan berat diperlukan untuk membandingkan estimasi emisi TPA dan daur ulang. Tombol **Coba dengan satu foto / Try a photo** membuka alur Catat material yang sudah ada, sedangkan **Lihat cara kerjanya / See how it works** membuka Panduan & uji AI. Foto katalog maupun unggahan sendiri tetap tersedia; membuka alur tidak menghapus draft atau menyimpan catatan otomatis. Pengantar tersedia dalam kedua bahasa dan kelima tema, tanpa mengubah batasan estimasi atau mengklaim pengurangan emisi yang sudah terbukti.

Diagram **Alur penggunaan CarbonTrace / How to use CarbonTrace** berada sebelum statistik. Empat kartu terhubung mengikuti urutan Foto & AI, Material & berat, Tinjau estimasi, dan Simpan; setiap kartu memiliki ikon dan penjelasan singkat. Penanda membedakan AI opsional, pemeriksaan/hasil timbang wajib, estimasi opsional, serta penyimpanan di browser setelah Simpan ditekan. Diagram bersifat informatif, bukan pintasan yang melewati validasi formulir. Pada layar lebar alur dibaca mendatar; pada layar sempit kartu tersusun vertikal dan panah mengarah ke bawah. Diagram memakai HTML/SVG yang mengikuti bahasa dan tema aplikasi tanpa dependensi diagram tambahan. Status parameter aktif dan tautan pengaturannya tetap tersedia.

Kartu panduan memisahkan isi dan kelompok tombol dengan jarak yang konsisten. Pada desktop, tinggi kartu dan posisi kelompok tombol sejajar; pada ponsel, kartu tersusun vertikal dan tombol memenuhi lebar kartu. Sidebar desktop dapat digulir jika tinggi layar tidak cukup untuk seluruh isinya.

### Penanda interaksi

Isian yang dapat diedit, daftar pilihan, tombol sekunder, serta bagian yang dapat dibuka memiliki batas dan penanda fokus yang lebih tegas pada kelima tema. Label **Wajib / Required** menandai foto unggahan, konfirmasi material, berat, dan isian yang diperlukan untuk menyimpan faktor khusus; label **Opsional / Optional** menandai pilihan tambahan. **Otomatis / Automatic** menandai ID sampel yang hanya dapat dibaca. Foto yang sudah tersedia ditandai **Foto siap / Photo ready**; membuka ulang catatan tidak mengharuskan unggah ulang. Ini penjelasan visual dan aksesibilitas, bukan perubahan aturan validasi.

Pilihan parameter berada dalam panel **Tindakan Anda / Your action**. Status membedakan rujukan yang **belum diterapkan** dari set yang **sudah aktif**; memilih saja tetap tidak mengubah pengaturan. Parameter masih opsional untuk pencatatan material. Filter riwayat memiliki label yang selalu terlihat, dan bagian yang dapat dibuka memakai penanda `+`/`-` serta tetap mendukung keyboard. Label Wajib berlaku pada alur terkait, bukan berarti semua pengaturan wajib diisi sebelum mulai mencatat.

### Cara mencatat

1. Buka **Catat material**, langkah **Foto & AI**. Pilih **Pilih dari katalog** atau **Unggah foto sendiri**. Katalog berisi **Dataset training** (78 foto) dan **Dataset test** (54 foto: 14 drywall baru, 28 regresi PET/kardus, dan 12 CT eksplorasi). CT bukan bagian skor evaluasi. Unggahan sendiri memperoleh ID `UPL-<UUID>` dan tidak menambah dataset otomatis.
2. Analisis AI **opsional**. Klik **Analisis foto** bila dibutuhkan; setelah analisis dimulai, tunggu hasilnya sebelum melanjutkan agar tidak menyimpan di tengah inferensi. **Gunakan saran setelah diperiksa** merupakan tindakan eksplisit dan membawa pengguna ke langkah material/berat. Jika model gagal, lanjutkan pemeriksaan manual tanpa prediksi pengganti.
3. Pada **Material & berat**, konfirmasikan/koreksi bahan dan isi hasil timbang positif dalam gram. Keduanya wajib; tidak ada berat bawaan. Kesalahan menghentikan kemajuan dan mengarahkan fokus ke isian terkait.
4. Setelah material dikonfirmasi pengguna, faktor yang belum ada diisi default: **WARM Set 1 untuk PET/kardus, Set 5 untuk drywall**. Hasil AI saja tidak menerapkan faktor. Pilihan tersimpan, termasuk parameter khusus dan data lama, tidak ditimpa. Default memakai asumsi AS, bukan faktor Indonesia atau bukti kondisi fasilitas.
5. Pada **Tinjau estimasi**, periksa sumber dan gunakan **Pilih / ubah parameter** bila diperlukan. Material mengikuti konfirmasi dan tidak dipilih ulang. Daftar hanya memuat rujukan yang mendukungnya, default di atas dan Parameter khusus terakhir. **Terapkan set** mengganti material tersebut saja, tanpa menghapus faktor material lain atau snapshot riwayat. Pengaturan umum tetap memiliki pemilih material. Matikan **Hitung estimasi emisi untuk catatan ini** untuk menyimpan material/berat tanpa faktor pada record; preferensi faktor tetap tersimpan dan CO2e kosong, bukan nol.
6. Pada **Simpan**, periksa ringkasan dan tekan **Simpan catatan**. Sebelum tombol ini ditekan, draft belum menjadi catatan. Keberhasilan menampilkan ID dan pilihan melihat riwayat atau memilih sampel berikutnya.
7. Gunakan **Riwayat & ekspor** untuk memeriksa metadata AI/sumber atau mengubah catatan. **Ubah** membuka langkah material/berat. Filter hanya memengaruhi tampilan; **Ekspor semua catatan (CSV)** mencakup seluruh catatan aktif, bukan hanya hasil filter.

Tombol Kembali dan perpindahan menu mempertahankan draft selama halaman tetap dibuka. Mengganti sampel ketika ada perubahan belum tersimpan meminta konfirmasi; batal mempertahankan foto dan input sebelumnya. Draft tidak disimpan otomatis untuk pemulihan setelah memuat ulang/menutup halaman. Bahasa dan tema tidak mengubah langkah aktif atau isi draft.

Label katalog memakai format **ID / nama material**, tanpa angka tambahan pada deskripsi, misalnya `CT-007 / Botol PET` atau `CT-007 / PET bottle`. Dalam masing-masing kelompok training/test, foto diurutkan alfabetis menurut nama file lengkap, bukan material atau nomor suffix. File CT tetap berurutan sebelum file SYN; `CT-009_01.png` dan `CT-012_01.png` mendahului `SYN-DRYWALL-008.png`. Urutan tidak berubah karena bahasa atau status tercatat.

Keterangan foto memakai pola yang sama: material referensi, peran data, status verifikasi, serta petunjuk pemeriksaan sesuai material. Peran eksplorasi tetap dinyatakan di luar pelatihan/evaluasi, tanpa menjadi akhiran nama. Riwayat, teks alternatif foto dan arsip memakai nama tampilan yang seragam. Nama kanonis dan nama lama tetap dapat dicari; nama pada CSV penelitian, ID, snapshot, pembagian dataset dan bobot model tidak diubah.

ID sampel yang sama diperbarui tanpa menambah hitungan. Hasil analisis tersimpan diberi label sebagai hasil historis ketika dibuka lagi; jalankan ulang bila foto berubah. **Catat tanpa hasil AI** melepaskan analisis dari formulir sebelum menyimpan.

**Unggah foto sendiri** berada langsung di langkah **Foto & AI**. JPG, PNG, atau WebP maksimal 10 MB dan 24 megapiksel diperiksa format dan isinya, lalu dibuatkan salinan JPEG dengan sisi terpanjang maksimal 1024 piksel. Pratinjau, inferensi, dan foto tersimpan memakai salinan yang sama. Foto asli di perangkat tidak diubah.

Unggahan dapat mengikuti seluruh alur pencatatan, termasuk pemeriksaan material, berat manual, estimasi, dan **Simpan catatan**. Unggah dan analisis saja belum menyimpan foto atau catatan secara persisten. Foto dapat dipakai tanpa AI; jika hanya ingin menguji klasifikasi, jangan tekan Simpan catatan. **Panduan & uji AI** menyediakan pintasan ke alur yang sama, bukan formulir unggahan terpisah.

**Ubah** dari riwayat membuka kembali foto dan ID yang tersimpan, termasuk setelah halaman dimuat ulang. Mengubah berat/material memperbarui ID yang sama; mengunggah foto lain membuat ID baru agar foto dan inferensi historis tidak tertukar. Menghapus catatan unggahan juga menghapus salinan fotonya dari browser, bukan file asli pada perangkat. Unggahan dan koreksi tidak melatih ulang model atau menjadi data latih/uji otomatis.

Jika model gagal dimuat, kesalahan ditampilkan dan **Muat ulang model** tersedia. Pencatatan manual tetap berjalan, tanpa prediksi pengganti. Analisis dan sidik piksel membutuhkan HTTPS atau localhost.

### Membaca hasil estimasi

Langkah **Tinjau estimasi** dan **Simpan** menampilkan kesimpulan dari faktor aktif dan berat yang sama dengan angka pratinjau. Selisih positif berarti alternatif diperkirakan lebih rendah; selisih negatif berarti skenario awal lebih rendah. Nilai neto skenario yang negatif dijelaskan terpisah karena dapat memasukkan manfaat penggantian produksi material baru, bukan pengukuran CO2 yang diserap benda.

Jika selisih tepat nol, tidak ada keunggulan emisi menurut parameter tersebut. Selisih yang tidak nol tetapi membulat menjadi nol pada tampilan enam desimal diberi keterangan khusus, bukan disebut sama atau dijadikan alasan otomatis memilih daur ulang. Data tidak lengkap, faktor yang tidak mendukung material, dan perhitungan tidak valid tetap tidak menghasilkan kesimpulan emisi.

Untuk rujukan WARM/PLACES yang memperkirakan alternatif daur ulang lebih rendah, saran tindak lanjut tetap bergantung pada penerimaan material oleh pengelola serta kesesuaian kondisi setempat. Parameter khusus meminta pemeriksaan skenario, fasilitas, dan batas sumber. Penjelasan ini tidak mengubah faktor, rumus, validasi, snapshot historis, format CSV, atau model AI; penyimpanan catatan bukan bukti pengurangan emisi atau kredit karbon.

### Insight riwayat

**Riwayat & ekspor** merangkum catatan yang sedang ditampilkan setelah pencarian/filter, bukan seluruh katalog atau arsip. Insight mencakup massa tercatat, komposisi material, jumlah catatan dengan faktor tersimpan, serta hasil AI/koreksi kategori yang tersimpan. Persetujuan pengguna bukan pengukuran akurasi model; massa dan material tetap mengikuti isian pengguna.

Perbandingan memakai snapshot faktor pada catatan, tidak dihitung ulang dengan pengaturan terbaru. Catatan dikelompokkan berdasarkan material, angka faktor, nama skenario, judul/URL sumber, konteks/batas metode, serta identitas rujukan. Waktu penerapan faktor tidak membedakan basis jika semua unsur tersebut sama. Satu kelompok dapat memberikan kesimpulan langsung; kelompok berbeda ditampilkan terpisah dan tidak dibuatkan satu total CO2e lintas kelompok. Rincian sumber dapat dibuka tanpa mengubah catatan.

Rincian rujukan menampilkan satu kartu selebar area isi untuk setiap kelompok, tersusun vertikal pada semua ukuran layar. Setiap kartu memisahkan material/rujukan, jumlah catatan dan berat, hasil perbandingan, langkah berikutnya, kedua skenario, lalu sumber dan asumsi. Penjelasan rujukan bawaan menggunakan paragraf bahasa sederhana dengan angka, satuan, cakupan dan batas metode yang tetap sama. Teks konteks parameter khusus atau data lama ditampilkan apa adanya; metadata asli dan ekspor penelitian tidak ditulis ulang.

Tombol **Tampilkan catatan tanpa faktor** hanya mengganti filter kelengkapan sambil mempertahankan pencarian/material. Untuk menambahkan estimasi pada catatan lama, gunakan **Ubah**, pilih rujukan sesuai, lalu simpan ulang. Ekspor CSV tetap mencakup semua catatan aktif. Nilai selisih di tabel/insight ditampilkan enam desimal seperti pratinjau; angka tersimpan dan CSV tidak berubah. Selisih kecil yang membulat ke nol dibedakan dari kesamaan tepat, sedangkan data gagal dimuat/diringkas ditampilkan sebagai tidak tersedia dengan kesalahan yang jelas.

## Model dan dataset

- Dataset formal: **120 foto**, masing-masing 40 untuk `SYN-PET`, `SYN-CRD`, dan `SYN-DRYWALL`, suffix 001-040. Tambahan CT-001 sampai CT-012 adalah eksplorasi; katalog menjadi **132 foto**. CT tidak masuk latihan, skor evaluasi, atau confusion matrix.
- Pada 26 Oktober 2026 pengguna mengonfirmasi bahwa tambahan 40 drywall dan CT-009 sampai CT-012 adalah foto barang nyata, objeknya berbeda antar-ID, dan bahannya papan gipsum berlapis kertas. Asal, label bahan, independensi objek dan ketiadaan kontaminasi tidak diverifikasi independen; `SYN` tetap hanya nama ID.
- **Latih: 78 foto sumber, 26 per kelas.** Seluruh 52 foto latih PET/kardus dipertahankan. Tambahkan 26 drywall dari ranking SHA-256 `20261026:<ID>`; 14 sisanya ditahan untuk uji. Split dan hash disimpan sebelum satu pelatihan, tanpa tuning atau pengacakan ulang berdasarkan hasil.
- **Uji lama/regresi: 28 PET/kardus**, 14 per kelas. Semua ID yang pernah diuji versi sebelumnya tetap di luar latihan. Tidak disebut foto baru pada pembaruan tiga kelas.
- **Uji baru: 14 drywall saja.** Kelompok ini tidak memiliki referensi PET/kardus dan tidak dapat menetapkan precision umum untuk ketiga kelas. Matrix gabungan 42 foto seimbang (14 per kelas), tetapi mencampur bukti baru dan regresi.
- Latar drywall dan sebagian foto lain serupa. Hash yang berbeda tidak membuktikan objek atau adegan independen. Koleksi internal ini bukan evaluasi eksternal atau sampel acak kondisi penggunaan.
- Empat varian setiap foto latih (asli, cermin horizontal, kecerahan x0,9 dan x1,1) menghasilkan **312 vektor fitur**, bukan 312 benda independen. Hash sumber dan JPEG diperiksa untuk mencegah duplikat identik.
- MobileNetV1 0.25 beku menghasilkan 256 fitur dari `conv_pw_13_relu`, global average pooling dan normalisasi L2. Head softmax **tiga kelas, 771 parameter** dilatih 200 epoch. Seed inisialisasi 20261024, learning rate 0,03 dan L2 0,001 dipertahankan; batch penuh 312, shuffle false. Tidak ada validasi terpisah atau tuning pada holdout.
- Model aktif: **`ct-mobilenet-913cfe5aa706`**. Uji baru drywall **14/14** dan regresi PET/kardus **28/28** sesuai label. Matrix gabungan memiliki diagonal 14/14/14; hasil bukan 42 uji baru atau bukti akurasi universal.
- Angka skor dalam laporan berasal dari skrip evaluasi. Setiap analisis browser menghitung skornya sendiri dari piksel yang dibaca; skor tersimpan bukan salinan angka pada laporan.
- Browser membaca RGB pada resolusi alami JPEG melalui canvas, bukan ukuran pratinjau CSS. Mengubah lebar layar tidak mengubah dimensi piksel masukan, skor, atau sidik piksel untuk foto yang sama pada browser yang sama. Perbedaan decoder JPEG antar-runtime tetap dapat menghasilkan skor berbeda dari laporan Node.js. Hasil historis tidak dihitung ulang otomatis.
- Model hanya membandingkan tiga kelas. Papan semen dan bahan lain dapat mendapat skor tinggi yang keliru. Softmax bukan probabilitas terkalibrasi atau verifikasi komposisi bahan, keselamatan puing, atau ada/tidaknya zat berbahaya.
- Antarmuka menyebut hasil satu gambar **Skor foto / Photo score**, terpisah dari akurasi pada foto berlabel. Pengguna tetap memeriksa material dan hasil timbang. Jangan memecah atau menangani puing berbahaya untuk demonstrasi.

Artefak berada di [public/models](public/models). [Laporan aktif](public/models/carbontrace/report.json) memakai schema v3, urutan label eksplisit `pet/cardboard/drywall`, hash data/bobot, seluruh ID, split, hiperparameter dan hasil tiap foto. `new-holdout` hanya drywall; `previous-test` adalah regresi PET/kardus. Versi mengikuti hash bobot head.

Head model dimuat dari [folder versi aktif](public/models/carbontrace/ct-mobilenet-913cfe5aa706). Arsip [versi 80 foto](public/models/carbontrace/ct-mobilenet-414f2c4df422), [versi 40 foto](public/models/carbontrace/ct-mobilenet-b090d45c6b58), dan [versi awal](public/models/carbontrace/ct-mobilenet-4aa1cd74741b) dipertahankan. Analisis dua kelas lama tetap menyimpan dua skor dan versi aslinya, tanpa skor drywall buatan. Pengaturan faktor lama dibaca dengan slot drywall kosong, tidak ditulis ulang otomatis.

Pelatihan menyiapkan kandidat di cache, mengevaluasi dan memvalidasinya, lalu menerbitkan folder versi sebelum mengganti laporan aktif secara atomik. Kegagalan sebelum publikasi tidak mengganti head model aktif. Publikasi ditolak bila laporan aktif berubah selama proses atau artefak dengan versi yang sama berbeda isinya.

### Melatih ulang secara lokal

```powershell
.\scripts\prepare-sample-photos.ps1
npm run train
npm test
npm run build
```

Pelatihan memakai TensorFlow.js CPU, tanpa layanan klasifikasi eksternal atau paket native `tfjs-node`. Checkpoint publik MobileNet diunduh saat pertama kali dibutuhkan dan disimpan di cache dependency. Gambar pengguna tidak dikirim ke sumber checkpoint. Model yang diekspor dan bobotnya dilayani dari origin aplikasi sendiri; tidak ada unduhan model dari CDN saat inferensi.

Setelah melatih ulang, muat ulang halaman agar model baru dimuat. Sumber checkpoint dan lisensi Apache-2.0 disertakan dalam folder model. Backbone berasal dari [checkpoint MobileNet TensorFlow.js](https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json), dengan pendekatan ekstraksi fitur seperti [contoh transfer learning TensorFlow.js](https://github.com/tensorflow/tfjs-examples/tree/master/webcam-transfer-learning).

## Faktor dan sumber

- Saat aplikasi dibuka, tidak ada faktor yang diisi diam-diam. Default baru diterapkan sesudah konfirmasi material oleh pengguna dan hanya bila slot material kosong. Preferensi lama/pilihan khusus dipertahankan. Menonaktifkan estimasi berlaku pada draft/record ini; record lama tanpa faktor tetap demikian ketika dibuka, sampai pengguna memilih mengaktifkan estimasi.
- **Set 1** memakai EPA WARM v16, landfill rata-rata nasional AS dibanding daur ulang.
- **Set 2** memakai WARM v16, landfill tanpa sistem pengumpulan/pemulihan gas (No Recovery) dibanding daur ulang. Ini bukan gas yang ditangkap lalu dibakar (flaring) atau digunakan untuk energi.
- **Set 3** memakai PLACES Indonesia (TCI/SIMTech), PET ke Sanitary Landfill dibanding daur ulang mekanis. Faktor kg CO2e/kg PET: awal `0.095579`, alternatif `-2.497533`.
- **Set 4** memakai PLACES Indonesia, PET ke Open Dump/TPA terbuka dibanding daur ulang mekanis. Faktor: awal `0.101700`, alternatif `-2.497533`. Open Dump tidak sama dengan Open Burning.
- Set 3/4 hanya PET; Set 1/2 PET/kardus; Set 5 hanya drywall. Daftar difilter menurut material yang diatur, dengan default terlebih dahulu. Penerapan mengubah satu material saja, sehingga PET PLACES, kardus WARM, dan drywall WARM dapat hidup berdampingan dengan identitas sumber masing-masing. Nilai pada record lama hanya berubah setelah edit dan simpan ulang.
- Set 5 `warm16-drywall-us-average-r1` memakai **E53/C53**, faktor **-0,067287 / +0,028756 kg CO2e/kg**. Selisih untuk 1 kg adalah **-0,096043** menggunakan faktor enam desimal aplikasi. Nilai negatif landfill mencakup penyimpanan karbon kertas, bukan penyerapan CO2 mineral gipsum. Hasil ini bukan anjuran landfill; risiko H2S, kontaminasi, aturan dan penerimaan fasilitas harus diperiksa. Cakupan hanya drywall biasa berlapis kertas, bukan papan semen atau puing campuran; tidak ada faktor Indonesia yang diverifikasi untuk drywall.
- **Parameter khusus** menyediakan isian sendiri dan disimpan per material. Mengedit angka rujukan membuatnya berstatus khusus, bukan tetap mengklaim preset.
- Masing-masing rujukan memiliki penjelasan asumsi, kegunaan, tabel faktor, lokasi angka sumber, serta tautan workbook EPA atau kueri kalkulator PLACES dan metodologinya di aplikasi.
- Set 1/2 memakai konteks Amerika Serikat. Set 3/4 memakai konteks model Indonesia, **bukan faktor resmi pemerintah Indonesia atau pengukuran fasilitas tertentu**. Kondisi fasilitas, jalur pengolahan aktual, dan kesesuaian lokasi belum diverifikasi.
- Satuan faktor adalah **kg CO2e/kg material**. Masukkan nilai yang konsisten dengan dokumen dan skenario yang dicatat.
- Nilai WARM dikonversi dari MTCO2e/US short ton dengan `x 1000 / 907.18474` dan dibulatkan enam desimal. Sel yang dipakai: E8/C8, E9/C9 untuk Set 1; F8/C8, F9/C9 untuk Set 2.
- Nilai PLACES diambil dari **GHG emissions - Details**, Indonesia/PET, kueri `1.000.000 metric tonnes` pada 24 Oktober 2026: Sanitary Landfill `95.579 / -2.497.533 tonnes CO2e`; Open Dump `101.700 / -2.497.533`. Masing-masing angka dibagi `1.000.000` menjadi kg CO2e/kg. Kueri besar mengurangi pembulatan tampilan dan bukan massa sampel proyek atau bukti akurasi enam desimal. Kueri satu ton juga diperiksa: penghematan tampil `2.59` dan `2.60 tonnes CO2e`.
- PLACES menggunakan batas hilir pengelolaan limbah, dampak Ecoinvent v3.9, asumsi transport lokal Indonesia 20 km, substitusi PET virgin 95%, dan jalur reject sesuai model. Metodologi SSEA diperbarui Oktober 2025; tanggal akses bukan tahun seluruh data lapangan. Metode PLACES dan WARM berbeda, sehingga perbedaan hasil tidak bisa ditafsirkan sebagai pengaruh negara saja.
- Angka nol valid. Faktor neto negatif diperbolehkan jika memang didukung oleh metode sumber.
- Rumus: `massa_g / 1000 * (faktor_awal - faktor_alternatif)`. Selisih negatif tidak diubah menjadi penghematan positif.
- Pada rujukan WARM/PLACES, skenario awal mengasumsikan material masuk landfill/TPA sesuai set dan alternatif mengasumsikan massa yang sama didaur ulang. Nilai neto dapat memasukkan produksi baru yang dihindari (serta penyimpanan karbon pada WARM); bukan pengukuran gas langsung.
- Sumber dan konteks wajib diisi. Menyimpan tautan atau judul tidak berarti aplikasi sudah memverifikasi metode tersebut.
- Setiap catatan menyimpan salinan faktor, sumber, konteks, waktu, ID set, dan nama set. Mengubah atau mengosongkan pengaturan tidak mengubah catatan lama otomatis. ID preset berversi r1 menjaga identitas rujukan historis; nilai rujukan tidak dapat diedit sambil mempertahankan identitas preset.
- Estimasi total hanya menjumlah catatan yang sudah memiliki faktor; dashboard menunjukkan berapa catatan yang belum dihitung. Tidak adanya estimasi dibedakan dari hasil sah bernilai nol.

Dokumentasi angka asli, konversi, asumsi, kegunaan, dan rujukan masing-masing set terdapat di [Parameter Set Emisi](docs/Parameter-Set-Emisi.md). Panduan Markdown dan Word juga dapat diunduh melalui panel parameter di aplikasi.

## Penyimpanan dan arsip

Catatan lama tidak dihapus atau dipromosikan menjadi data nyata. Data dari `carbontrace.demo.v1` disalin ke bagian **Arsip data contoh** dalam `carbontrace.records.v2`; kunci lama tetap utuh. Ringkasan aktif tidak memakai contoh lama. Catatan manual versi sebelumnya tetap dapat dibaca tanpa diberi skor atau prediksi AI secara otomatis.

Catatan aktif dan arsip disimpan dalam `carbontrace.records.v2` di localStorage; catatan katalog lama tetap kompatibel. Catatan unggahan menambahkan metadata foto opsional (ID, nama asli, dimensi, ukuran, hash JPEG, dan waktu unggah). Blob JPEG disimpan di IndexedDB `carbontrace.photos.v1`, object store `photos`, bukan dimasukkan sebagai Base64 ke localStorage. Hasil inferensi tetap menyimpan versi model, dua skor, sidik piksel RGB, dan waktu analisis. Pengaturan faktor memakai `carbontrace.factors.v1`. Semua penyimpanan berada pada browser dan origin yang sama; tidak ada akun atau sinkronisasi server.

Penyimpanan foto menunggu transaksi IndexedDB selesai sebelum metadata catatan ditulis. Jika penulisan metadata gagal, salinan foto yang baru dibuat dibersihkan; kegagalan pembersihan juga dilaporkan, bukan dianggap berhasil. Foto yang hilang atau hash-nya tidak sesuai ditampilkan sebagai kesalahan. Jika foto tidak dapat disimpan, tidak ada konfirmasi simpan palsu. Katalog tetap dapat dicatat tanpa akses penyimpanan foto unggahan.

Kesalahan format, izin, atau kapasitas penyimpanan ditampilkan secara eksplisit. Kapasitas foto mengikuti kuota browser, bukan tanpa batas. Data yang gagal dimuat tidak ditimpa otomatis, dan penulisan yang gagal tidak dianggap berhasil. Setelah memperbaiki penyimpanan, gunakan **Muat ulang penyimpanan**. Menghapus data situs dapat menghapus catatan dan foto; simpan CSV serta foto asli secara terpisah karena CSV tidak membawa berkas gambar.

## Foto sampel

File sumber berada di [src/assets/samples](src/assets/samples): 12 CT dan masing-masing 40 `SYN-PET`, `SYN-CRD`, `SYN-DRYWALL`. Script tidak mengubah isi atau nama PNG sumber.

Tampilan, pelatihan, dan thumbnail memakai JPEG di [src/assets/samples/optimized](src/assets/samples/optimized), pola `<ID>_01.jpg`, maksimal 1024 piksel dan kualitas 85. Total 132 JPEG adalah 24.419.473 byte (23,29 MiB). Setiap file tetap di bawah 512 KiB; batas total tes dinaikkan menjadi 30 MiB karena katalog bertambah. PNG sumber tidak ikut build. Hash seluruh foto dataset lama tetap sama.

Untuk membuat ulang salinan setelah mengganti foto sumber, jalankan melalui PowerShell di Windows:

```powershell
.\scripts\prepare-sample-photos.ps1
```

Script mempertahankan rasio gambar, memeriksa batas ukuran tampilan, dan memastikan hash file sumber tidak berubah. Pengujian juga memeriksa pemetaan dan keberadaan seluruh gambar. File gambar yang hilang atau gagal dimuat dilaporkan di aplikasi, tanpa ilustrasi pengganti diam-diam.

Label **Foto pengguna** menyatakan asal file, bukan jaminan keaslian atau bahan. Label 120 foto formal adalah referensi internal; kategori catatan tetap dikonfirmasi pengguna.

[Tabel contoh berat 132 foto](docs/CarbonTrace-Contoh-Berat-132-Foto.xlsx) mengikuti 78 training dan 54 test pada aplikasi, dengan thumbnail dan tautan per ID. Seluruh nilai 88 foto sebelumnya dipertahankan. Tambahan 44 drywall memakai **contoh/asumsi 1.000 g per kelompok target**, bukan estimasi dari gambar atau hasil timbang. Kolom hasil ukur tetap kosong. Angka contoh tidak dipakai melatih classifier atau menjadi observasi paper. [Workbook 88 foto](docs/CarbonTrace-Contoh-Berat-88-Foto.xlsx) dan [workbook 48 foto](docs/CarbonTrace-Contoh-Berat-48-Foto.xlsx) adalah arsip.

Foto tampilan akan ikut dipublikasikan jika aplikasi dideploy. Pastikan tidak ada alamat, nomor telepon, atau informasi pribadi sebelum publikasi.

## Batasan yang wajib dipertahankan

- Berat dilaporkan pengguna; aplikasi tidak menimbang benda atau memverifikasinya secara independen.
- Inferensi memakai bobot terlatih yang tersimpan. Kegagalan model atau gambar dilaporkan, bukan diganti hasil fixture.
- Empat belas uji drywall baru dan 28 regresi PET/kardus bukan 42 uji baru atau bukti kinerja pada semua kondisi. Perlu uji baru ketiga kelas dengan audit label dan variasi adegan. Jumlah objek fisik juga tidak ditetapkan dari jumlah foto.
- Faktor berasal dari rujukan model yang dipilih atau input pengguna dengan sumber dan konteks, bukan faktor resmi yang dijamin oleh aplikasi.
- Konfirmasi manusia tidak sama dengan verifikasi pengolahan atau pengurangan emisi.
- Tidak ada bukti daur ulang aktual, additionality, penerbitan kredit karbon, nilai perdagangan, atau integrasi registri.
- Foto, jenis material, hasil timbang, sumber faktor, dan pengolahan aktual belum diverifikasi independen.

## Ekspor

CSV aktif mempertahankan 24 kolom awal, enam kolom metadata AI, lalu menambahkan `factor_parameter_set_id` dan `factor_parameter_set_name` (total **32 kolom**). Metode berupa `MANUAL` atau `AI_ASSISTED_HUMAN_CONFIRMED`; status AI per catatan adalah `NOT_ANALYZED` atau `MODEL_INFERENCE_RECORDED`, bukan klaim bahwa semua catatan telah dianalisis.

Enam kolom tambahan adalah `ai_predicted_material`, `ai_score_not_accuracy`, `ai_model_version`, `ai_input_rgb_sha256`, `ai_analyzed_at`, dan `ai_human_correction`. Sidik piksel merupakan SHA-256 dari dimensi dan RGB yang dianalisis, bukan hash file PNG asli atau bukti keaslian foto.

Berat tetap `USER_REPORTED_NOT_VERIFIED`. Kolom faktor memuat salinan sumber yang dipakai saat catatan disimpan; estimasi kosong ketika faktor belum tersedia. Faktor khusus berstatus `USER_SUPPLIED_NOT_VERIFIED`; preset WARM/PLACES berstatus `REFERENCE_MODEL_NOT_SITE_VERIFIED`. Data lama tanpa metadata parameter tetap dibaca sebagai parameter khusus, tanpa dilabeli preset secara otomatis.

Untuk unggahan, `sample_name` menyimpan nama file asli, `current_sample_image_file` berisi nama salinan `<UPL-ID>.jpg`, dan `current_sample_image_source` adalah `USER_UPLOADED_UNVERIFIED`; katalog tetap `USER_PROVIDED_UNVERIFIED`. CSV tidak menyertakan blob foto. Hash JPEG pada metadata foto berbeda dari hash dimensi/RGB inferensi; keduanya bukan bukti keaslian fisik.

Ekspor arsip menggunakan format versi sebelumnya dan tetap menandai datanya sebagai contoh. Arsip tidak tercampur ke CSV aktif. Kolom foto katalog menjelaskan katalog saat ekspor, bukan bukti foto historis. Verifikasi isi gambar, pengolahan, dan penerbitan kredit tetap `NO`.

Panduan Word terdapat di [dokumen penggunaan](docs/CarbonTrace-Skenario-dan-Panduan-Penggunaan.docx).

Paper tersedia sebagai [PDF submission](docs/CarbonTrace-GENIUS-AI-Research-Paper.pdf) dan [Word](docs/CarbonTrace-GENIUS-AI-Research-Paper.docx). Model tetap `ct-mobilenet-913cfe5aa706`, dengan matrix gabungan 42 foto serta rincian 14 drywall baru/28 regresi. Dokumentasi alur faktor diselaraskan dengan default/per-material/opsi tanpa estimasi. Kesalahan CT-009 eksplorasi tetap dilaporkan di luar akurasi formal. Nilai berat Excel tetap contoh. Unggah build terbaru sebelum submission agar tautan laporan model sesuai dengan hosting.

[Prompt produksi video Scout](docs/CarbonTrace-Prompt-Microsoft-Scout-Video-Submission.txt) telah diselaraskan dengan model tiga kelas, workbook 132 foto dan pembagian uji saat ini. Fokus dua demo tetap PET/kardus; statistik drywall dan keterbatasannya diperbarui. Durasi rencana bagian utama tetap 130 detik, dengan satu penjelasan narasi tentang contoh berat dan tanpa label demo permanen. File ini adalah instruksi produksi, bukan video atau bukti pemrosesan suara.

## Pengembangan berikutnya

Perluas foto dari benda dan adegan yang beragam, audit label serta hubungan antar-foto, dan uji bahan di luar tiga kelas. Evaluasi independen diperlukan sebelum klaim generalisasi atau akurasi luas. Peran AI dan status antarmuka harus mengikuti kemampuan yang benar-benar diuji. Integrasi perangkat tetap opsional.

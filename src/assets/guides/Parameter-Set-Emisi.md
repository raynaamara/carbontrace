# Parameter Set Emisi CarbonTrace

Dokumentasi rujukan parameter. Set 1-4 r1 dipertahankan; Set 5 drywall ditambahkan pada 26 Oktober 2026. Faktor awal berasal dari workbook resmi US EPA WARM v16 dan PLACES Indonesia/PET yang diperiksa 24 Oktober 2026; workbook yang diperiksa ulang tetap memiliki hash yang sama. Tidak ada faktor resmi pemerintah Indonesia atau pengukuran fasilitas yang ditetapkan oleh dokumen ini.

## 1. Dua skenario yang dibandingkan

- **Skenario awal: landfill/TPA.** Material bekas diasumsikan dibuang ke landfill dengan kondisi pengelolaan gas yang ditetapkan oleh parameter set.
- **Skenario alternatif: daur ulang.** Massa material yang sama diasumsikan didaur ulang dengan batas perhitungan sumber yang dipilih: WARM atau PLACES.

Ini adalah perbandingan model. Foto dan pencatatan massa tidak membuktikan bahwa material benar-benar masuk TPA atau diterima pengelola daur ulang. Jika pengelolaan awal sebenarnya sudah daur ulang, baseline landfill tidak boleh dipresentasikan sebagai kondisi aktual tanpa bukti.

CarbonTrace menghitung:

```text
massa_kg = massa_gram / 1000
emisi_neto_awal = massa_kg * faktor_awal
emisi_neto_alternatif = massa_kg * faktor_alternatif
selisih = massa_kg * (faktor_awal - faktor_alternatif)
```

Selisih positif berarti alternatif lebih rendah menurut model; selisih negatif berarti alternatif lebih tinggi. Nilai kosong (`--`) berarti belum dapat dihitung, bukan nol. Nilai nol sah bila dua faktor sama.

Faktor neto negatif dapat mencakup manfaat produksi material baru yang dihindari atau penyimpanan karbon dalam model daur hidup. Faktor negatif bukan bukti bahwa proses daur ulang secara langsung menyerap CO2 sebanyak angka tersebut.

Pada **Tinjau estimasi** dan **Simpan**, aplikasi menjelaskan nilai negatif dan menampilkan kesimpulan serta saran tindak lanjut. Contoh pembacaan angka tampilan: `0,000491 - (-0,025117) = 0,025608 kg CO2e`. Artinya alternatif diperkirakan lebih rendah sebesar selisih itu untuk berat dan rujukan yang digunakan, bukan ada pengurangan emisi yang telah dibuktikan. Perhitungan tetap memakai angka asli; tampilan dibulatkan enam desimal.

Jika selisih tepat nol, parameter tidak menunjukkan keunggulan emisi. Jika selisih tidak nol tetapi membulat menjadi nol, aplikasi meminta pemeriksaan ulang tanpa menyatakan keduanya identik. Tanpa faktor atau berat yang valid, kesimpulan belum tersedia. Saran daur ulang untuk rujukan yang mendukungnya tetap mensyaratkan pemeriksaan kondisi dan penerimaan fasilitas setempat; memilih angka paling rendah saja tidak membuktikan pilihan itu dapat diterapkan.

## 2. Rujukan dan satuan

### Default dan material yang dikonfirmasi

Default adalah WARM Set 1 untuk PET/kardus dan Set 5 untuk drywall. Penerapan otomatis hanya terjadi setelah pengguna mengonfirmasi material, baik lewat pilihan manual maupun **Gunakan saran setelah diperiksa**, dan hanya bila faktor material itu belum tersedia. Memuat aplikasi, memilih foto, atau menjalankan AI saja tidak mengisi faktor. Pilihan lama, parameter khusus, serta sumber yang sudah disimpan tetap dipakai.

Default memakai asumsi AS, bukan faktor Indonesia atau verifikasi fasilitas. Pengguna tetap perlu membaca konteks dan dapat memilih rujukan lain. Daftar hanya memuat set yang mendukung material, default di atas dan Parameter khusus terakhir. Penerapan hanya mengganti material ini; faktor material lain tidak dihapus.

Dari **Tinjau estimasi**, material ditampilkan sebagai informasi terkonfirmasi, bukan pilihan ulang. Pada pengaturan umum, pemilih material tetap tersedia. Matikan **Hitung estimasi emisi untuk catatan ini** untuk menyimpan record tanpa angka CO2e; preferensi faktor tidak dihapus. Record lama yang memang tanpa faktor tetap tanpa estimasi saat dibuka.

Sumber bersama Set 1 dan Set 2 (WARM). Rujukan PLACES untuk Set 3/4 dijelaskan pada bagian 5.

- [Workbook resmi EPA WARM v16, Desember 2023](https://www.epa.gov/system/files/documents/2023-12/warm_v16.xls).
- [Halaman versi dan pembaruan WARM](https://www.epa.gov/waste-reduction-model/versions-waste-reduction-model).
- [Penjelasan penggunaan dan batasan resmi EPA](https://www.epa.gov/waste-reduction-model/basic-information-about-waste-reduction-model).

WARM adalah alat perbandingan tingkat penyaringan, bukan alat pengukuran komprehensif, inventori GRK organisasi, atau dasar keputusan final lokasi tertentu.

Satuan asli workbook adalah **metric tonnes CO2e per US short ton material**. Satuan aplikasi adalah **kg CO2e/kg material**:

```text
1 metric tonne CO2e = 1000 kg CO2e
1 US short ton material = 907.18474 kg material
faktor_aplikasi = faktor_WARM * 1000 / 907.18474
```

Angka aplikasi dibulatkan enam desimal. Banyaknya digit tidak menunjukkan peningkatan ketelitian metode atau kesesuaian lokasi.

SHA-256 workbook yang diperiksa:

```text
5886bef6721735efdb95ffd904c1c50ff1d6f0ea567b2c8c7f8ee4633d519f22
```

## 3. Set 1 - WARM v16: landfill rata-rata AS

ID: `warm16-us-average-r1`

**Awal:** landfill dengan asumsi National Average Amerika Serikat.

**Alternatif:** daur ulang material bekas menurut WARM v16.

**Asumsi:** listrik dan kelembapan rata-rata nasional AS, campuran kondisi pengendalian gas landfill nasional, serta jarak pengangkutan default 20 mil untuk landfill dan daur ulang.

| Material aplikasi | Kategori WARM | Faktor awal (kg CO2e/kg) | Faktor alternatif (kg CO2e/kg) | Sel sumber pada Summary Data |
|---|---|---:|---:|---|
| Botol PET | PET | 0,022327 | -1,141687 | E8 / C8 |
| Kardus | Corrugated Containers | 0,200213 | -3,456117 | E9 / C9 |

**Kapan dipakai:** membandingkan pengelolaan material dengan asumsi default WARM atau mempelajari metode. Rata-rata AS tidak otomatis menggambarkan TPA atau sistem daur ulang Indonesia.

## 4. Set 2 - WARM v16: landfill tanpa sistem LFG

ID: `warm16-no-lfg-r1`

**Awal:** landfill tanpa sistem pengumpulan/pemulihan landfill gas, yaitu kolom No Recovery.

**Alternatif:** daur ulang material bekas, sama dengan Set 1.

**Asumsi:** rujukan AS dengan kondisi landfill No Recovery; default listrik/kelembapan nasional dan jarak transportasi 20 mil tetap dipakai. Ini **bukan** skenario gas dikumpulkan lalu dibakar (flaring) atau dipakai untuk energi.

| Material aplikasi | Kategori WARM | Faktor awal (kg CO2e/kg) | Faktor alternatif (kg CO2e/kg) | Sel sumber pada Summary Data |
|---|---|---:|---:|---|
| Botol PET | PET | 0,022327 | -1,141687 | F8 / C8 |
| Kardus | Corrugated Containers | 1,833663 | -3,456117 | F9 / C9 |

**Kapan dipakai:** menguji asumsi landfill tanpa sistem LFG atau melakukan analisis sensitivitas. Jangan menyebutnya faktor lokasi Indonesia hanya karena fasilitas lokal diduga tidak memiliki pemulihan gas.

PET memiliki nilai sama pada kedua set di workbook ini, sedangkan kardus berbeda. Perbedaan berasal dari model material dan pengelolaan gas, bukan dari skor AI.

## 5. Set 3 dan Set 4 - PLACES Indonesia, khusus PET

PLACES (Plastic Lifecycle Assessment Calculator for the Environment and Society) dikembangkan The Circulate Initiative bersama SIMTech/A*STAR. Model LCA ini mencakup Indonesia dan memiliki kategori PET. **Kardus tidak tercakup.** Kategori Generic di PLACES berarti campuran plastik, bukan semua sampah, sehingga tidak boleh digunakan untuk kardus.

### Set 3 - landfill saniter

ID: `places-id-pet-sanitary-20261024-r1`

Awal: **Sanitary Landfill**, dipilih secara eksplisit untuk Indonesia/PET. Alternatif: daur ulang mekanis PET. Gunakan bila skenario yang sedang dikaji adalah landfill saniter; jangan menganggap seluruh TPA Indonesia memenuhi kondisi ini.

### Set 4 - TPA terbuka

ID: `places-id-pet-open-dump-20261024-r1`

Awal: **Open Dump**, dipilih secara eksplisit untuk Indonesia/PET. Alternatif: daur ulang mekanis PET dengan faktor yang sama dengan Set 3. Open Dump tidak sama dengan Sanitary Landfill atau Open Burning/pembakaran terbuka. Jangan menetapkan baseline hanya karena menghasilkan estimasi lebih besar.

| Set | Material | Awal (kg CO2e/kg) | Alternatif (kg CO2e/kg) | Selisih per kg |
|---|---|---:|---:|---:|
| Set 3 | PET | 0,095579 | -2,497533 | 2,593112 |
| Set 4 | PET | 0,101700 | -2,497533 | 2,599233 |
| Set 3/4 | Kardus | Tidak tersedia | Tidak tersedia | Tidak dihitung |

### Asumsi dan batas penggunaan

- Batas hilir: pengumpulan, transportasi, pengolahan, dan jalur akhir limbah. Nilai daur ulang neto memasukkan manfaat produksi material baru yang dihindari, bukan hanya emisi mesin.
- Metodologi SSEA diperbarui **Oktober 2025** dan menyebut Ecoinvent v3.9 sebagai sumber faktor dampak.
- Asumsi Indonesia mencakup transport lokal **20 km** antara pengumpulan dan fasilitas. Model juga mempunyai asumsi untuk impor dan jalur limbah yang tidak terkumpul; angka ini bukan jarak yang diukur dari rumah pengguna.
- PET daur ulang diasumsikan menggantikan PET virgin dengan rasio **95%**. Reject mengikuti campuran sanitary landfill, open dump, dan open burning dalam model Indonesia.
- Kueri memakai satu negara (Indonesia), satu polimer (PET), dan satu EOL eksplisit; **bukan Default EOL Fates**.
- Sumber model bersifat kontekstual negara dan menggunakan data/asumsi dari berbagai tahun. Tanggal akses 2026 bukan berarti seluruh data lapangan berasal dari 2026.
- Bukan faktor resmi KLHK/pemerintah, bukan pengukuran fasilitas pengguna, dan bukan metodologi penerbitan kredit karbon. Metode PLACES berbeda dari WARM; perbedaan hasil antar-set bukan semata-mata efek negara.
- Gunakan massa PET yang berada dalam batas model. Tutup PP, label, isi botol, kardus, dan jenis plastik lain tidak otomatis termasuk.

### Pengambilan angka dan normalisasi

Keluaran kalkulator dibaca dari **GHG emissions - Details**, baris **Initial impact** dan **Recycling impact**, untuk kueri 1.000.000 **metric tonnes** PET. Kueri besar hanya untuk memperoleh koefisien dengan mengurangi efek pembulatan tampilan; ini bukan volume proyek atau hasil timbang Rayna.

| Negara / polimer | EOL awal | Jumlah kueri (ton material) | Initial impact (ton CO2e) | Recycling impact (ton CO2e) | Environmental savings (ton CO2e) |
|---|---|---:|---:|---:|---:|
| Indonesia / PET | Sanitary Landfill | 1.000.000 | 95.579 | -2.497.533 | 2.593.112 |
| Indonesia / PET | Open Dump | 1.000.000 | 101.700 | -2.497.533 | 2.599.233 |

```text
faktor_kg_CO2e_per_kg = keluaran_tonnes_CO2e / jumlah_kueri_metric_tonnes
Set 3: 95579 / 1000000 = 0.095579
Set 4: 101700 / 1000000 = 0.101700
Daur ulang: -2497533 / 1000000 = -2.497533
```

Satuan ton emisi dan ton material sama-sama dikali 1.000 untuk menjadi kg, sehingga rasionya tidak berubah. **Jangan memakai konversi US short ton WARM untuk PLACES.** Angka sumber dibulatkan oleh kalkulator; enam desimal hasil normalisasi tidak menunjukkan ketelitian fisik enam desimal.

Sebagai pemeriksaan terpisah, kueri satu ton PET menampilkan awal `0.10`, alternatif `-2.50`, dan penghematan `2.59 tonnes CO2e` untuk Sanitary Landfill, serta `2.60` untuk Open Dump. Menyalin komponen kueri kecil yang sudah dibulatkan lalu mengurangkannya dapat memberi `2.60` untuk kedua set; karena itu angka yang dibulatkan tersebut tidak dijadikan koefisien.

Untuk 100 gram PET pada Set 3: awal `0,0095579 kg CO2e`, alternatif `-0,2497533 kg CO2e`, selisih `0,2593112 kg CO2e` sebelum pembulatan tampilan. Ini perkiraan menurut skenario, bukan reduksi aktual yang sudah terbukti.

### Rujukan primer

- [PLACES: cakupan dan penjelasan TCI/SIMTech](https://www.thecirculateinitiative.org/plastic-lifecycle-assessment-calculator-for-the-environment-and-society/).
- [Metodologi dan hasil SSEA, Oktober 2025, PDF](https://www.thecirculateinitiative.org/wp-content/uploads/The-Circulate-Initiative-PLACES-SSEA-Methodology-and-Results_Oct-2025.pdf).
- [Kueri sumber Set 3: Indonesia/PET, Sanitary Landfill, 1.000.000 ton](https://places.thecirculateinitiative.org/?lang=en&countries=id&pt_0_id=0&pt_0_type=PET&pt_0_qt=1000000&pt_0_eol=Sanitary+Landfill&pt_ct=1).
- [Kueri sumber Set 4: Indonesia/PET, Open Dump, 1.000.000 ton](https://places.thecirculateinitiative.org/?lang=en&countries=id&pt_0_id=0&pt_0_type=PET&pt_0_qt=1000000&pt_0_eol=Open+Dump&pt_ct=1).

PLACES dapat meminta login. Gunakan GHG Details untuk memeriksa komponen, bukan hanya angka penghematan di halaman ringkasan. SHA-256 PDF metodologi yang diperiksa:

```text
5063ec73fa7ce9e09f9238658c8bf0683cc3de383b95fb629a9d152080615b7b
```

Set 3/4 tetap hanya PET. Menerapkannya pada PET tidak menghapus faktor kardus atau drywall. Set 1/2 mendukung PET/kardus; Set 5 hanya drywall. Setiap material mempertahankan pilihannya, dan record lama tetap memiliki snapshot sumber masing-masing.

### Set 5 - WARM drywall, landfill rata-rata AS

ID: `warm16-drywall-us-average-r1`. Cakupan: drywall biasa setengah inci berlapis kertas. Bukan gipsum murni, papan semen/fiber-cement, atau semua puing bangunan.

| Material | Awal: landfill AS (kg CO2e/kg) | Alternatif: daur ulang (kg CO2e/kg) | Sel sumber |
|---|---:|---:|---|
| Drywall berlapis kertas | -0,067287 | +0,028756 | E53 / C53 |

Untuk 1 kg, selisih aplikasi adalah `-0,067287 - 0,028756 = -0,096043 kg CO2e`. Artinya landfill diperkirakan lebih rendah menurut asumsi model, **bukan anjuran membuang ke landfill**.

Angka landfill memasukkan penyimpanan karbon lapisan kertas dan asumsi metana drywall dapat diabaikan. Ini bukan CO2 yang diserap mineral gipsum. Daur ulang dimodelkan menjadi drywall baru (19%) dan penggunaan pertanian (81%). Asumsi AS dan transport default 20 mil tidak menjadi faktor Indonesia.

[Metodologi konstruksi EPA, bab Drywall](https://www.epa.gov/system/files/documents/2023-12/warm_construction_materials_v16_dec.pdf#page=55) menjelaskan tabel faktor pada Exhibit 6-5 dan 6-17, serta risiko hidrogen sulfida (H2S) pada kondisi landfill tertentu. Ada satu kalimat uraian yang tidak konsisten dengan tabel; angka implementasi mengikuti workbook dan tabel numerik yang cocok, bukan menjadikan hasil ini rekomendasi lingkungan menyeluruh. Dampak kesehatan, kontaminasi, aturan, dan penerimaan fasilitas harus diperiksa. Jangan memecah atau menangani puing berbahaya untuk demonstrasi.

Nilai asli `E53 = -0.061041329359337294`, `C53 = 0.02608665626869755` MTCO2e/short ton. Jika selisih dihitung dari faktor asli lalu dibulatkan, hasilnya `-0,096042`; aplikasi secara konsisten menghitung dari faktor kg/kg yang sudah dibulatkan enam desimal, yaitu `-0,096043`. Jangan mencampur kedua urutan pembulatan.

## 6. Nilai asli WARM untuk audit

| Material | Kolom/sel | Nilai asli (MTCO2e/short ton) |
|---|---|---:|
| PET, daur ulang | C8 | -1.0357206316437553 |
| PET, landfill rata-rata nasional | E8 | 0.020254519141196047 |
| PET, landfill No Recovery | F8 | 0.020254519141196047 |
| Corrugated Containers, daur ulang | C9 | -3.1353369086789917 |
| Corrugated Containers, landfill rata-rata nasional | E9 | 0.18162984857485934 |
| Corrugated Containers, landfill No Recovery | F9 | 1.6634715021436628 |

Kardus pada rujukan ini adalah kardus bergelombang, bukan semua jenis kertas atau kemasan minuman berlapis. Konfirmasikan bahan serta massa yang berada dalam batas perhitungan.

## 7. Parameter khusus

Pilih **Parameter khusus** bila menggunakan metode lain atau menyesuaikan data sesuai lokasi dan proses. Isi nama kedua skenario, faktor dalam satuan aplikasi, judul sumber beserta tahun/versi, konteks wilayah dan batas sistem, serta tautan bila tersedia.

Mengubah angka rujukan menjadi parameter khusus, bukan tetap beridentitas Set 1/2/3/4/5. Kombinasi sumber per material bukan satu set global. Aplikasi tidak memverifikasi keabsahan metode, tautan, atau wilayah isian pengguna.

## 8. Cara menerapkan di aplikasi

1. Buka **Parameter emisi**, pilih Set 1/2 (WARM PET/kardus), Set 3/4 (PLACES PET), Set 5 (WARM drywall), atau parameter khusus.
2. Memilih rujukan hanya menampilkan pratinjau dokumentasi dan nilainya; belum mengubah pengaturan aktif.
3. Tombol **Terapkan set** menyebut material yang diganti. Konfirmasikan penggantian bila material ini sudah memiliki faktor. Faktor material lain dan snapshot record lama tidak diubah.
4. Untuk parameter khusus, buka **Parameter khusus (lanjutan)**, pilih material, isi sumber dan angka, lalu **Simpan faktor**. Pengaturan khusus berlaku per material.
5. Pada **Catat material**, pilih katalog atau **Unggah foto sendiri** pada Foto & AI, lalu lanjutkan ke Material & berat. Analisis AI opsional; konfirmasi bahan dan hasil timbang wajib. Unggahan memakai faktor untuk material yang dikonfirmasi, bukan faktor yang ditebak dari nama file.
6. Langkah **Tinjau estimasi** menampilkan emisi neto awal, alternatif, selisih, serta kesimpulan dan saran tindak lanjut menurut pengaturan aktif. Keterangan nilai negatif muncul bila salah satu emisi neto negatif. Tombol **Pilih / ubah parameter** membuka pengaturan tanpa menghapus draft; gunakan tombol kembali untuk melanjutkan tinjauan. Tanpa faktor, catatan tetap boleh disimpan tanpa angka CO2e.
7. Buka langkah **Simpan** dan tekan **Simpan catatan** agar nilai/sumber masuk riwayat. Untuk menerapkan set baru pada catatan lama, buka **Ubah** di **Riwayat & ekspor**, tinjau ulang, lalu simpan.

Memilih rujukan tidak boleh didasarkan hanya pada hasil estimasi terbesar. Laporkan asumsi dan alasan pemilihan, serta bandingkan sensitivitas jika kondisi fasilitas belum diketahui.

Insight riwayat mengikuti filter dan snapshot setiap record. Material, faktor, skenario, sumber atau konteks berbeda tetap terpisah, tanpa total CO2e lintas basis. Ringkasan juga tidak menjumlahkan CO2e bila basis berbeda; massa tetap dirangkum. Pengaturan tidak memperbarui record otomatis. Koreksi AI bukan akurasi, dan massa tercatat bukan bukti daur ulang.

## 9. Jejak data dan batas klaim

Setiap catatan menyimpan salinan nilai, skenario, sumber, konteks, waktu, ID parameter set, dan nama set. Pergantian pengaturan tidak menulis ulang catatan lama otomatis. Data lama tanpa metadata set tetap dibaca sebagai parameter khusus, bukan dipromosikan menjadi preset.

CSV aktif menambahkan `factor_parameter_set_id` dan `factor_parameter_set_name` setelah kolom yang sudah ada, sehingga totalnya 32 kolom. Rujukan WARM dan PLACES ditandai `REFERENCE_MODEL_NOT_SITE_VERIFIED`: angka dari model referensi, tetapi kesesuaian lokasi belum diverifikasi. Parameter khusus tetap `USER_SUPPLIED_NOT_VERIFIED`. Kardus tanpa faktor pada set Indonesia berstatus `NOT_CONFIGURED`, bukan hasil emisi nol. Ekspor arsip data contoh tetap terpisah.

AI memberi saran kategori; model tidak menetapkan faktor emisi, menimbang material, memverifikasi pengolahan, membuktikan additionality, atau menerbitkan kredit karbon. Estimasi ini tidak sama dengan pengurangan emisi aktual terverifikasi.

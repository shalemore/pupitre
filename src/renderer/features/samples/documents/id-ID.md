# Panduan Pupitre

![Pupitre](./logo.svg)

Pupitre adalah editor Markdown untuk desktop. Dokumen berupa berkas `.md` biasa: yang Anda lihat dirender di tempat, dan sintaks Markdown muncul saat kursor berada di atasnya. Panduan ini juga menjadi contoh apa yang dirender oleh editor; sunting sesuka Anda, berkas ini tidak disimpan kecuali Anda memilih **Simpan sebagai**.

## Menyunting

Letakkan kursor di dalam **teks tebal**, sebuah `kode sebaris`, atau sebuah [tautan](https://github.com/shalemore/pupitre) dan sintaksnya muncul di sekelilingnya. Penandanya berperilaku seperti teks:

- Hapus penanda untuk menghapus formatnya; tambah atau hapus `#` di depan judul untuk mengubah tingkatnya.
- Memilih teks menampilkan sintaksnya, dan menyalin akan menyalin Markdown.
- <kbd>Ctrl</kbd>+klik mengikuti tautan: alamat web terbuka di peramban, tautan `#judul` menggulir ke judul tersebut, dan tautan ke berkas Markdown di samping dokumen akan membukanya.
- Pemformatan tersedia di menu **Paragraf** dan **Format**, menu konteks, serta pintasan di bawah.

<details>
<summary>Pintasan papan ketik (Ctrl adalah ⌘ di macOS)</summary>

| Tindakan                      | Pintasan                                                                                                    |
| :---------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Tebal / Miring / Kode sebaris | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| Garis Bawah                   | <kbd>Ctrl</kbd>+<kbd>U</kbd>                                                                                |
| Coret                         | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| Hapus Format                  | <kbd>Ctrl</kbd>+<kbd>\\</kbd>                                                                               |
| Tautan                        | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| Sisipkan Gambar               | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                               |
| Judul 1–6 / Paragraf          | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| Kutipan                       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| Daftar bernomor / butir       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| Blok kode / blok matematika   | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| Tabel                         | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| Cari / Ganti                  | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| Buka Kembali Tab yang Ditutup | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>                                                               |
| Bilah samping                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| Mode Kode Sumber              | <kbd>Ctrl</kbd>+<kbd>/</kbd>                                                                                |
| Mode fokus / mesin tik        | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| Atur ulang perbesaran         | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>                                                               |
| Preferensi                    | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## Mode menulis

- **Mode fokus** meredupkan semua kecuali paragraf yang sedang Anda tulis.
- **Mode mesin tik** menjaga baris yang sedang Anda tulis tetap di tengah jendela, atau di dekat bagian atas atau bawah jendela, sesuai dengan Preferensi › Editor.

Keduanya ada di menu **Tampilan** dan di Preferensi › Editor, serta dapat digabungkan.

## Gaya jendela

Preferensi › Tampilan › Gaya jendela berganti antara **Klasik** dan **Imersif**. Pada gaya imersif dokumen berada dalam kartu di dalam jendela; bilah judul dan bilah samping menghilang begitu Anda mengetik atau menggulir, lalu kembali saat penunjuk mencapai bagian atas atau tepi samping jendela. Menyematkan bilah samping akan menjaganya tetap terbuka, dan menyeret tepi bilah samping mengubah ukurannya.

## Berkas dan gambar

- Pupitre mempertahankan akhir baris berkas yang dibuka kecuali Preferensi › Markdown menentukan lain. Sintaks yang disisipkan perintah pemformatan juga diatur di sana.
- Gambar yang ditempel disimpan di folder di samping dokumen (`assets` secara bawaan, Preferensi › Markdown). Dokumen yang belum disimpan menyimpannya di memori dan menuliskannya saat pertama kali disimpan.
- Preferensi › Umum › Aplikasi Markdown bawaan membuat Pupitre membuka berkas `.md` dari pengelola berkas.
- Preferensi disimpan di `settings.json`; Preferensi › Tentang menampilkan foldernya. Hanya nilai yang berbeda dari bawaannya yang ditulis, dan bidang yang tidak dapat dibaca kembali ke bawaannya tanpa memengaruhi yang lain.
- Sebuah folder dapat memiliki pengaturannya sendiri: saat folder terbuka, Preferensi menampilkan tombol pilihan antara **Global** dan **Folder Ini**. Yang Anda ubah di bawah **Folder Ini** masuk ke `.pupitre/settings.json` di dalamnya, yang dibuat pada perubahan pertama dan dilapisi di atas pengaturan global setiap kali folder itu terbuka. Mengatur ulang pengaturan di sana mengembalikannya ke nilai global.

## Tema

Sebuah tema menata seluruh jendela dan dokumen. Preferensi › Tampilan mencantumkannya bersama skema warna yang didukung, dan tema tersendiri dapat dipilih untuk mode gelap.

Tema disertakan bersama aplikasi: masing-masing berupa folder di `src/renderer/themes/<name>/` dengan sebuah `index.css`, dan nama folder itulah nama temanya. Font atau gambar yang dipakai tema diletakkan di folder yang sama dan dirujuk dengan `url()` relatif.

```css
:root {
  /* Skema warna yang didukung tema ini: terang, gelap, atau keduanya */
  color-scheme: light dark;

  /* Font isi teks bawaan; bisa diganti di preferensi */
  --font-document: Georgia, serif;

  /* Token desain yang berlaku untuk seluruh jendela */
  --ui-surface-1: oklch(0.99 0.01 90);
  --ui-brand: oklch(0.55 0.12 250);
}

@media (prefers-color-scheme: dark) {
  :root {
    --ui-surface-1: oklch(0.2 0.01 90);
  }
}

.md-document .md-h1 {
  font-size: 2em;
}
```

- Warna diatur melalui token `--ui-*` (permukaan, teks, aksen) dan `--syntax-*` untuk kode. Bawaan dan daftar lengkapnya ada di `src/renderer/app.css` dan tema `pupitre`.
- Bilah kutipan sebaiknya memakai `var(--alert-color, …)` agar peringatan tetap mempertahankan warnanya.
- Ukuran font isi, tinggi baris, dan lebar konten milik pengguna dan selalu menang; gunakan `em` untuk ukuran di dalam dokumen dan properti logis seperti `padding-inline-start` agar teks kanan-ke-kiri tercermin dengan benar.

## Rujukan Markdown

### Teks

**Tebal**, _miring_, ~~coret~~, `kode sebaris`, [tautan](https://commonmark.org), H~2~O, x^2^, ==sorotan==, :tada:, dan <kbd>Esc</kbd>. HTML sebaris dirender bila merupakan elemen yang utuh dan ditampilkan sebagai sumber bila tidak. Paragraf yang hanya berisi `[TOC]` menjadi daftar judul dokumen.

> Sebuah kutipan.
>
> > Kutipan bersarang.

> [!NOTE]
> Notifikasi GitHub: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, dan `[!CAUTION]`.

> [!WARNING]
> Penandanya harus berada di baris pertama kutipan.

### Daftar

1. Bernomor
   - Bersarang, berbutir
   - [x] Tugas dapat ditandai selesai
   - [ ] Dan tidak dicentang
2. Daftar dapat memuat kode:

   ```sh
   npm run dev
   ```

### Tabel

| Kiri  | Tengah  | Kanan |
| :---- | :-----: | ----: |
| Sel   |  Teks   |  1.00 |
| Lebih | Panjang | 10.50 |

### Kode

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### Matematika

Sebaris $e^{i\pi} + 1 = 0$ dan tampilan blok:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Persamaan kimia memakai `\ce`: $\ce{2H2 + O2 -> 2H2O}$.

### Diagram

```mermaid
flowchart LR
    Open[Buka berkas] --> Edit[Edit] --> Save[Simpan]
    Edit -->|Tempel gambar| Assets[(folder assets)]
```

### Catatan kaki

Sebuah kalimat dengan catatan kaki[^1].

[^1]: Catatan kaki dicantumkan di akhir dokumen.

<!-- Komentar tetap tersimpan di berkas dan ditampilkan sebagai sumber. -->

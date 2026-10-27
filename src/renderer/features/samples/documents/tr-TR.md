# Pupitre Kılavuzu

![Pupitre](./logo.svg)

Pupitre bir masaüstü Markdown düzenleyicisidir. Belgeler sıradan `.md` dosyalarıdır: gördüğünüz içerik yerinde işlenir ve imleç üzerindeyken Markdown sözdizimi görünür. Bu kılavuz aynı zamanda düzenleyicinin nasıl işlediğine dair bir örnektir; dilediğiniz gibi düzenleyin, **Farklı Kaydet** seçmediğiniz sürece kaydedilmez.

## Düzenleme

İmleci **kalın metnin**, bir `satır içi kodun` ya da bir [bağlantının](https://github.com/shalemore/pupitre) içine getirin, söz dizimi çevresinde görünür. İşaretler metin gibi davranır:

- Bir işareti silmek biçimi kaldırır; bir başlığın önüne `#` eklemek ya da silmek düzeyini değiştirir.
- Metin seçildiğinde içindeki söz dizimi görünür ve kopyalamak Markdown kopyalar.
- Bir bağlantıyı <kbd>Ctrl</kbd>+tıklayarak açın: web adresleri tarayıcıda açılır, `#başlık` bağlantıları ilgili başlığa kaydırır ve belgenin yanındaki bir Markdown dosyasına verilen bağlantılar o dosyayı açar.
- Biçimlendirme **Paragraf** ve **Biçim** menülerinde, sağ tık menüsünde ve aşağıdaki kısayollarda bulunur.

<details>
<summary>Klavye kısayolları (macOS'ta Ctrl yerine ⌘)</summary>

| İşlem                           | Kısayol                                                                                                     |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| Kalın / İtalik / Satır içi kod  | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| Altı Çizili                     | <kbd>Ctrl</kbd>+<kbd>U</kbd>                                                                                |
| Üstü çizili                     | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| Biçimi Temizle                  | <kbd>Ctrl</kbd>+<kbd>\\</kbd>                                                                               |
| Bağlantı                        | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| Resim Ekle                      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                               |
| Başlık 1–6 / Paragraf           | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| Alıntı                          | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| Numaralı / madde işaretli liste | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| Kod bloğu / Matematik bloğu     | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| Tablo                           | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| Bul / Değiştir                  | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| Kapatılan Sekmeyi Yeniden Aç    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>                                                               |
| Kenar çubukları                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| Kaynak Kodu Modu                | <kbd>Ctrl</kbd>+<kbd>/</kbd>                                                                                |
| Odak modu / Daktilo modu        | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| Yakınlaştırmayı sıfırla         | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>                                                               |
| Tercihler                       | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## Yazma modları

- **Odak modu**, yazdığınız paragraf dışındaki her şeyi soluklaştırır.
- **Daktilo modu**, yazılan satırı Tercihler › Düzenleyici ayarına göre pencerenin ortasında, üstüne veya altına yakın tutar.

İkisi de **Görünüm** menüsünde ve Tercihler › Düzenleyici altında bulunur ve birlikte kullanılabilir.

## Pencere stili

Tercihler › Görünüm › Pencere Stili, **Klasik** ile **Sürükleyici** arasında geçiş yapar. Sürükleyici stilde belge pencerenin içindeki bir kartta gösterilir; yazmaya veya kaydırmaya başladığınızda başlık çubuğu ve kenar çubukları gizlenir, işaretçi pencerenin üstüne ya da bir yan kenarına geldiğinde geri döner. Kenar çubuğundaki sabitleme kenar çubuklarını açık tutar ve bir kenar çubuğunun kenarını sürüklemek boyutunu değiştirir.

## Dosyalar ve resimler

- Pupitre, Tercihler › Markdown aksini söylemedikçe açtığı dosyanın satır sonlarını korur. Biçimlendirme komutlarının eklediği söz dizimi de orada ayarlanır.
- Yapıştırılan resimler belgenin yanındaki bir klasöre kaydedilir (varsayılan olarak `assets`, bkz. Tercihler › Markdown). Henüz kaydedilmemiş bir belge onları bellekte tutar ve ilk kaydetmede yazar.
- Tercihler › Genel › Varsayılan Markdown Uygulaması, Pupitre'nin `.md` dosyalarını dosya yöneticisinden açmasını sağlar.
- Tercihler `settings.json` içinde saklanır; Tercihler › Hakkında klasörünü gösterir. Yalnızca varsayılandan farklı değerler yazılır ve okunamayan bir alan diğerlerini etkilemeden varsayılana döner.
- Bir klasörün kendi ayarları olabilir: bir klasör açıkken Tercihler, **Global** ile **Bu Klasör** arasında bir geçiş gösterir. **Bu Klasör** altında değiştirdikleriniz içindeki `.pupitre/settings.json` dosyasına gider; bu dosya ilk değişiklikte oluşturulur ve o klasör açık olduğunda genel ayarların üzerine uygulanır. Buradaki bir ayarı sıfırlamak onu genel değere geri verir.

## Temalar

Bir tema tüm pencereyi ve belgeyi biçimlendirir. Tercihler › Görünüm, temaları destekledikleri renk şemalarıyla listeler ve koyu mod için ayrı bir tema seçilebilir.

Temalar uygulamayla birlikte gelir: her biri `src/renderer/themes/<ad>/` altında bir `index.css` içeren bir klasördür ve klasör adı temanın adıdır. Bir temanın kullandığı yazı tipleri veya resimler aynı klasörde durur ve göreli `url()` ile başvurulur.

```css
:root {
  /* Temanın desteklediği renk şemaları: açık, koyu veya ikisi */
  color-scheme: light dark;

  /* Gövde metninin varsayılan yazı tipi; tercihlerden değiştirilebilir */
  --font-document: Georgia, serif;

  /* Tüm pencerede kullanılan tasarım belirteçleri */
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

- Renkler `--ui-*` belirteçleriyle (yüzeyler, metin, vurgu) ve kod için `--syntax-*` ile ayarlanır. Varsayılan değerleri ve tam liste `src/renderer/app.css` ile `pupitre` temasında bulunur.
- Alıntı çubukları `var(--alert-color, …)` kullanmalıdır, böylece uyarılar kendi renklerini korur.
- Gövde yazı boyutu, satır aralığı ve içerik genişliği kullanıcıya aittir ve her zaman önceliklidir; belgedeki boyutlar için `em`, sağdan sola metnin ters görüntülenmesi için `padding-inline-start` gibi mantıksal özellikler kullanın.

## Markdown başvurusu

### Metin

**Kalın**, _italik_, ~~üstü çizili~~, `satır içi kod`, [bağlantılar](https://commonmark.org), H~2~O, x^2^, ==vurgular==, :tada: ve <kbd>Esc</kbd>. Satır içi HTML tam bir öğe olduğunda işlenir, aksi halde kaynak olarak gösterilir. Yalnızca `[TOC]` yazan bir paragraf, belgenin başlıklarının listesine dönüşür.

> Bir alıntı.
>
> > İç içe bir alıntı.

> [!NOTE]
> GitHub uyarıları: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` ve `[!CAUTION]`.

> [!WARNING]
> İşaretçi, alıntının ilk satırı olmalıdır.

### Listeler

1. Numaralı
   - İç içe, madde işaretli
   - [x] Görevler işaretlenebilir
   - [ ] Ve işareti kaldırılabilir
2. Listeler kod içerebilir:

   ```sh
   npm run dev
   ```

### Tablo

| Sol   | Orta  |   Sağ |
| :---- | :---: | ----: |
| Hücre | Hücre |  1.00 |
| Uzun  | Metin | 10.50 |

### Kod

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### Matematik

Satır içi $e^{i\pi} + 1 = 0$ ve blok olarak:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Kimyasal denklemler `\ce` kullanır: $\ce{2H2 + O2 -> 2H2O}$.

### Diyagramlar

```mermaid
flowchart LR
    Open[Dosya aç] --> Edit[Düzenle] --> Save[Kaydet]
    Edit -->|Resim yapıştır| Assets[(assets klasörü)]
```

### Dipnotlar

Dipnotlu bir cümle[^1].

[^1]: Dipnotlar belgenin sonunda listelenir.

<!-- Yorumlar dosyada saklanır ve kaynak olarak gösterilir. -->

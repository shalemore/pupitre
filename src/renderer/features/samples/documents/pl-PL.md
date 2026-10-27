# Przewodnik po Pupitre

![Pupitre](./logo.svg)

Pupitre to komputerowy edytor Markdown. Dokumenty to zwykłe pliki `.md`: to, co widzisz, jest renderowane na miejscu, a składnia Markdown pojawia się tam, gdzie jest kursor. Ten przewodnik jest też przykładem tego, co renderuje edytor; edytuj go swobodnie, zostanie zapisany tylko po wybraniu **Zapisz jako**.

## Edycja

Przenieś kursor do **pogrubionego tekstu**, `kodu w tekście` lub [łącza](https://github.com/shalemore/pupitre), a wokół niego pojawi się składnia. Znaczniki zachowują się jak tekst:

- Usuń znacznik, aby usunąć formatowanie; dodaj lub usuń `#` przed nagłówkiem, aby zmienić jego poziom.
- Zaznaczony tekst pokazuje swoją składnię, a kopiowanie kopiuje Markdown.
- <kbd>Ctrl</kbd>+kliknięcie otwiera łącze: adresy internetowe otwierają się w przeglądarce, łącza `#nagłówek` przewijają do nagłówka, a łącza do pliku Markdown obok dokumentu otwierają go.
- Formatowanie jest w menu **Akapit** i **Format**, w menu kontekstowym oraz w skrótach poniżej.

<details>
<summary>Skróty klawiaturowe (Ctrl to ⌘ w systemie macOS)</summary>

| Czynność                              | Skrót                                                                                                       |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| Pogrubienie / Kursywa / Kod w tekście | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| Przekreślenie                         | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| Podkreślenie                          | <kbd>Ctrl</kbd>+<kbd>U</kbd>                                                                                |
| Wyczyść formatowanie                  | <kbd>Ctrl</kbd>+<kbd>\\</kbd>                                                                               |
| Łącze                                 | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| Wstaw obraz…                          | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>                                                               |
| Nagłówek 1–6 / Akapit                 | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| Cytat                                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| Lista numerowana / punktowana         | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| Blok kodu / Blok matematyczny         | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| Tabela                                | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| Znajdź / Zamień                       | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| Otwórz ponownie zamkniętą kartę       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>                                                               |
| Paski boczne                          | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| Tryb kodu źródłowego                  | <kbd>Ctrl</kbd>+<kbd>/</kbd>                                                                                |
| Tryb skupienia / maszyny do pisania   | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| Przywróć powiększenie                 | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>                                                               |
| Ustawienia                            | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## Tryby pisania

- **Tryb skupienia** przyciemnia wszystko poza akapitem, w którym piszesz.
- **Tryb maszyny do pisania** utrzymuje pisaną linię na środku okna lub blisko jego góry albo dołu, zgodnie z Ustawienia › Edytor.

Oba są w menu **Widok** i w Ustawieniach › Edytor i można je łączyć.

## Styl okna

Ustawienia › Wygląd › Styl okna przełącza między **Klasycznym** a **Immersyjnym**. W stylu immersyjnym dokument znajduje się na karcie wewnątrz okna; pasek tytułu i paski boczne chowają się, gdy tylko zaczniesz pisać lub przewijać, i wracają, gdy wskaźnik dotrze do górnej lub bocznej krawędzi okna. Przypięte paski boczne pozostają otwarte, a przeciągnięcie krawędzi paska zmienia jego szerokość.

## Pliki i obrazy

- Pupitre zachowuje końce wierszy otwartego pliku, chyba że Ustawienia › Markdown mówią inaczej. Składnię wstawianą przez polecenia formatowania też ustawia się tam.
- Wklejone obrazy są zapisywane w folderze obok dokumentu (domyślnie `assets`, Ustawienia › Markdown). Dokument, który nie został jeszcze zapisany, trzyma je w pamięci i zapisze przy pierwszym zapisie.
- Ustawienia › Ogólne › Domyślna aplikacja Markdown sprawia, że Pupitre otwiera pliki `.md` z menedżera plików.
- Ustawienia są przechowywane w `settings.json`; Ustawienia › O programie pokazuje jego folder. Zapisywane są tylko wartości różne od domyślnych, a pole, którego nie da się odczytać, wraca do wartości domyślnej bez wpływu na pozostałe.
- Folder może mieć własne ustawienia: gdy folder jest otwarty, w ustawieniach pojawia się przełącznik między **Globalne** i **Ten folder**. Zmiany w sekcji **Ten folder** trafiają do `.pupitre/settings.json` w nim; plik powstaje przy pierwszej zmianie i jest nakładany na ustawienia globalne, gdy ten folder jest otwarty. Przywrócenie ustawienia w tym miejscu przywraca wartość globalną.

## Motywy

Motyw określa wygląd całego okna i dokumentu. Ustawienia › Wygląd listują je wraz z obsługiwanymi schematami kolorów, a dla trybu ciemnego można wybrać osobny motyw.

Motywy są dostarczane z aplikacją: każdy to folder w `src/renderer/themes/<nazwa>/` z plikiem `index.css`, a nazwa folderu jest nazwą motywu. Czcionki lub obrazy używane przez motyw leżą w tym samym folderze i są wskazywane względnymi `url()`.

```css
:root {
  /* Motywy kolorystyczne obsługiwane przez ten motyw: jasny, ciemny lub oba */
  color-scheme: light dark;

  /* Domyślna czcionka tekstu głównego; można ją zmienić w ustawieniach */
  --font-document: Georgia, serif;

  /* Tokeny projektu używane w całym oknie */
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

- Kolory ustawia się przez tokeny `--ui-*` (powierzchnie, tekst, akcent) oraz `--syntax-*` dla kodu. Ich wartości domyślne i pełna lista są w `src/renderer/app.css` i motywie `pupitre`.
- Paski cytatów powinny używać `var(--alert-color, …)`, aby alerty zachowały własne kolory.
- Rozmiar tekstu, odstęp między wierszami i szerokość treści należą do użytkownika i zawsze wygrywają; w dokumencie używaj `em` oraz właściwości logicznych, takich jak `padding-inline-start`, aby tekst od prawej do lewej był odbity lustrzanie.

## Dokumentacja Markdown

### Tekst

**Pogrubienie**, _kursywa_, ~~przekreślenie~~, `kod w tekście`, [łącza](https://commonmark.org), H~2~O, x^2^, ==wyróżnienie==, :tada: i <kbd>Esc</kbd>. Wbudowany HTML jest renderowany, gdy tworzy kompletny element, a w przeciwnym razie pokazywany jako źródło. Akapit zawierający tylko `[TOC]` zamienia się w listę nagłówków dokumentu.

> Cytat.
>
> > Zagnieżdżony cytat.

> [!NOTE]
> Alerty GitHuba: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` i `[!CAUTION]`.

> [!WARNING]
> Znacznik musi być pierwszą linią cytatu.

### Listy

1. Numerowana
   - Zagnieżdżona, punktowana
   - [x] Zadania można odhaczać
   - [ ] I odznaczać
2. Listy mogą zawierać kod:

   ```sh
   npm run dev
   ```

### Tabela

| Lewo    | Środek  | Prawo |
| :------ | :-----: | ----: |
| Komórka | Komórka |  1.00 |
| Dłuższa |  Tekst  | 10.50 |

### Kod

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### Matematyka

W tekście $e^{i\pi} + 1 = 0$ i w bloku:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

Równania chemiczne zapisuje się przez `\ce`: $\ce{2H2 + O2 -> 2H2O}$.

### Diagramy

```mermaid
flowchart LR
    Open[Otwórz plik] --> Edit[Edytuj] --> Save[Zapisz]
    Edit -->|Wklej obraz| Assets[(folder assets)]
```

### Przypisy

Zdanie z przypisem[^1].

[^1]: Przypisy są wymienione na końcu dokumentu.

<!-- Komentarze pozostają w pliku i są pokazywane jako źródło. -->

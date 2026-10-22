# Pupitre útmutató

![Pupitre](./logo.svg)

A Pupitre egy asztali Markdown-szerkesztő. A dokumentumok egyszerű `.md` fájlok: amit lát, a helyén jelenik meg, a Markdown-szintaxis pedig a kurzor helyén látszik. Ez az útmutató egyszersmind bemutatja, mit jelenít meg a szerkesztő; nyugodtan módosíthatja, csak a **Mentés másként** választásakor kerül mentésre.

## Szerkesztés

Helyezze a kurzort **félkövér szövegbe**, egy `soron belüli kódba` vagy egy [hivatkozásba](https://github.com/shalemore/pupitre), és a szintaxis megjelenik körülötte. A jelölők szövegként viselkednek:

- Egy nyitó jelölő után rögtön a Backspace megszünteti a formázást.
- A címsor elején írjon `#` karaktert a szint emeléséhez, a Backspace pedig csökkenti azt.
- A formázás a **Bekezdés** és **Formátum** menüben, a helyi menüben és az alábbi gyorsbillentyűkben található.

<details>
<summary>Gyorsbillentyűk (macOS-en a Ctrl helyett ⌘)</summary>

| Művelet                            | Gyorsbillentyű                                                                                              |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Félkövér / Dőlt / Soron belüli kód | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| Áthúzás                            | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| Hivatkozás                         | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| Címsor 1–6 / Bekezdés              | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| Idézet                             | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| Számozott / felsorolásos lista     | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| Kódblokk / Matematikai blokk       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| Táblázat                           | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| Keresés / Csere                    | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| Vázlat                             | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| Fókuszmód / Írógép mód             | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| Nagyítás visszaállítása            | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>                                                               |
| Beállítások                        | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## Írási módok

- A **fókuszmód** elhalványít mindent, kivéve azt a bekezdést, amelyet éppen ír.
- Az **írógép mód** a gépelt sort az ablak közepén tartja.

Mindkettő a **Nézet** menüben és a Beállítások › Szerkesztő alatt található, és kombinálhatók egymással.

## Ablakstílus

A Beállítások › Megjelenés › Ablakstílus a **Klasszikus** és az **Immerzív** között vált. Immerzív stílusban a dokumentum az ablakon belüli kártyán fekszik; a címsor és a vázlat visszahúzódik, amint gépelni vagy görgetni kezd, és visszatér, amikor a mutató eléri az ablak felső vagy kezdő szélét. A stílus a módosítás után megnyitott ablakokra érvényes.

## Fájlok és képek

- A Pupitre megtartja a megnyitott fájl sorvégződéseit, hacsak a Beállítások › Markdown nem rendelkezik másként. Ott állítható be az is, hogyan íródjanak mentéskor a listák, kiemelések, kódkerítések és vonalak.
- A beillesztett képek a dokumentum melletti mappába kerülnek (alapértelmezés szerint `assets`, Beállítások › Markdown). A még nem mentett dokumentum a memóriában tartja őket, és az első mentéskor írja ki.
- A Beállítások › Általános › Alapértelmezett Markdown-alkalmazás hatására a Pupitre a fájlkezelőből nyitja meg a `.md` fájlokat.
- A beállítások a `settings.json` fájlban vannak; a Beállítások › Névjegy mutatja a mappáját. Csak az alapértéktől eltérő értékek íródnak ki, és egy olvashatatlan mező visszaáll az alapértékre anélkül, hogy érintené a többit.

## Témák

Egy téma az egész ablak és a dokumentum megjelenését határozza meg. A Beállítások › Megjelenés az általuk támogatott színsémákkal együtt sorolja fel őket, a sötét módhoz pedig külön téma választható.

A témák az alkalmazással együtt érkeznek: mindegyik egy mappa a `src/renderer/themes/<név>/` alatt `index.css` fájllal, és a mappa neve a téma neve. A téma által használt betűtípusok vagy képek ugyanebben a mappában vannak, és relatív `url()` hivatkozásokkal érhetők el.

```css
:root {
  /* A téma által támogatott színsémák: világos, sötét vagy mindkettő */
  color-scheme: light dark;

  /* A törzsszöveg alapértelmezett betűtípusa; a beállításokban módosítható */
  --font-document: Georgia, serif;

  /* Az egész ablakban használt design-tokenek */
  --ui-surface-1: oklch(0.99 0.01 90);
  --ui-brand: oklch(0.55 0.12 250);
}

@media (prefers-color-scheme: dark) {
  :root {
    --ui-surface-1: oklch(0.2 0.01 90);
  }
}

.milkdown .ProseMirror h1 {
  font-size: 2em;
}
```

- A színek a `--ui-*` tokenekkel (felületek, szöveg, kiemelés) és a kódhoz a `--syntax-*` tokenekkel állíthatók be. Alapértékeik és a teljes lista a `src/renderer/app.css` fájlban és a `pupitre` témában található.
- Az idézetcsíkoknak `var(--alert-color, …)`-t kell használniuk, hogy a figyelmeztetések megtartsák színüket.
- A szöveg mérete, a sormagasság és a tartalom szélessége a felhasználóé, és mindig érvényesül; használjon `em` egységet a dokumentumban és logikai tulajdonságokat, például `padding-inline-start` értéket, hogy a jobbról balra írt szöveg tükröződjön.

## Markdown-referencia

### Szöveg

**Félkövér**, _dőlt_, ~~áthúzott~~, `soron belüli kód`, [hivatkozások](https://commonmark.org), H<sub>2</sub>O, x<sup>2</sup>, <kbd>Esc</kbd> és <mark>kiemelések</mark>. A soron belüli HTML akkor jelenik meg, ha teljes elemet alkot, máskülönben forráskódként látszik.

> Egy idézet.
>
> > Beágyazott idézet.

> [!NOTE]
> GitHub-figyelmeztetések: `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` és `[!CAUTION]`.

> [!WARNING]
> A jelölőnek az idézet első sorában kell lennie.

### Listák

1. Számozott
   - Beágyazott, felsorolásos
   - [x] A feladatok kipipálhatók
   - [ ] És visszavonhatók
2. A listák tartalmazhatnak kódot:

   ```sh
   npm run dev
   ```

### Táblázat

| Bal      | Közép  |  Jobb |
| :------- | :----: | ----: |
| Cella    | Cella  |  1.00 |
| Hosszabb | Szöveg | 10.50 |

### Kód

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### Matematika

Soron belül $e^{i\pi} + 1 = 0$ és blokként:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

### Diagramok

```mermaid
flowchart LR
    Open[Fájl megnyitása] --> Edit[Szerkesztés] --> Save[Mentés]
    Edit -->|Kép beillesztése| Assets[(assets mappa)]
```

### Lábjegyzetek

Egy mondat lábjegyzettel[^1].

[^1]: A lábjegyzetek a dokumentum végén jelennek meg.

<!-- A megjegyzések a fájlban maradnak, és forráskódként jelennek meg. -->

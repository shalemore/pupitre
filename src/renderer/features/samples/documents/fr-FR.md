# Guide de Pupitre

![Pupitre](./logo.svg)

Pupitre est un éditeur Markdown pour le bureau. Les documents sont de simples fichiers `.md` : ce que vous voyez est rendu sur place, et la syntaxe Markdown apparaît tant que le curseur s’y trouve. Ce guide illustre aussi ce que l’éditeur affiche ; modifiez-le librement, il n’est enregistré que si vous choisissez **Enregistrer sous**.

## Édition

Placez le curseur dans du **texte en gras**, un `extrait de code` ou un [lien](https://github.com/shalemore/pupitre) et sa syntaxe apparaît autour. Les marqueurs se comportent comme du texte :

- Retour arrière juste après un marqueur ouvrant supprime la mise en forme.
- Au début d’un titre, tapez `#` pour augmenter son niveau et Retour arrière pour le diminuer.
- La mise en forme se trouve dans les menus **Paragraphe** et **Format**, dans le menu contextuel et dans les raccourcis ci-dessous.

<details>
<summary>Raccourcis clavier (Ctrl correspond à ⌘ sous macOS)</summary>

| Action                                     | Raccourci                                                                                                   |
| :----------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| Gras / Italique / Code en ligne            | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| Barré                                      | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| Lien                                       | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| Titre 1–6 / Paragraphe                     | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| Citation                                   | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| Liste numérotée / à puces                  | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| Bloc de code / Bloc mathématique           | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| Tableau                                    | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| Rechercher / Remplacer                     | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| Plan                                       | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| Mode concentration / Mode machine à écrire | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| Réinitialiser le zoom                      | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>                                                               |
| Préférences                                | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## Modes d’écriture

- Le **Mode concentration** estompe tout sauf le paragraphe que vous écrivez.
- Le **Mode machine à écrire** garde la ligne en cours d’écriture au milieu de la fenêtre.

Les deux sont dans le menu **Affichage** et dans Préférences › Éditeur, et peuvent être combinés.

## Style de fenêtre

Préférences › Apparence › Style de fenêtre permet de passer de **Classique** à **Immersif**. Dans le style immersif, le document est placé dans une carte à l’intérieur de la fenêtre ; la barre de titre et le plan s’effacent dès que vous tapez ou faites défiler, et reviennent quand le pointeur atteint le haut ou le bord de début de la fenêtre. Le style s’applique aux fenêtres ouvertes après le changement.

## Fichiers et images

- Pupitre conserve les fins de ligne du fichier ouvert, sauf indication contraire dans Préférences › Markdown. C’est aussi là que se règle la façon dont les listes, l’emphase, les blocs de code et les filets sont écrits à l’enregistrement.
- Les images collées sont enregistrées dans un dossier à côté du document (`assets` par défaut, Préférences › Markdown). Un document pas encore enregistré les garde en mémoire et les écrit au premier enregistrement.
- Préférences › Général › Application Markdown par défaut fait ouvrir les fichiers `.md` avec Pupitre depuis le gestionnaire de fichiers.
- Les préférences sont stockées dans `settings.json` ; Préférences › À propos affiche son dossier. Seules les valeurs différentes des valeurs par défaut sont écrites, et un champ illisible revient à sa valeur par défaut sans toucher aux autres.

## Thèmes

Un thème met en forme toute la fenêtre et le document. Préférences › Apparence les liste avec les modes de couleur qu’ils gèrent, et un thème distinct peut être choisi pour le mode sombre.

Les thèmes sont livrés avec l’application : chacun est un dossier `src/renderer/themes/<name>/` contenant un `index.css`, et le nom du dossier est le nom du thème. Les polices ou images d’un thème se placent dans le même dossier et s’appellent avec des `url()` relatives.

```css
:root {
  /* The schemes this theme supports: light, dark or both */
  color-scheme: light dark;

  /* Default body font; users can override it in the preferences */
  --font-document: Georgia, serif;

  /* Design tokens used by the whole window */
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

- Les couleurs se définissent avec les jetons `--ui-*` (surfaces, texte, accent) et `--syntax-*` pour le code. Leurs valeurs par défaut et la liste complète se trouvent dans `src/renderer/app.css` et le thème `pupitre`.
- Les barres de citation doivent utiliser `var(--alert-color, …)` pour que les alertes gardent leurs couleurs.
- La taille de police, l’interligne et la largeur du contenu appartiennent à l’utilisateur et priment toujours ; utilisez `em` pour les tailles dans le document et des propriétés logiques comme `padding-inline-start` pour que le texte de droite à gauche soit inversé.

## Référence Markdown

### Texte

**Gras**, _italique_, ~~barré~~, `code en ligne`, [liens](https://commonmark.org), H<sub>2</sub>O, x<sup>2</sup>, <kbd>Échap</kbd> et <mark>surlignages</mark>. Le HTML en ligne est rendu lorsqu’il s’agit d’un élément complet, et affiché comme source sinon.

> Une citation.
>
> > Une citation imbriquée.

> [!NOTE]
> Alertes GitHub : `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` et `[!CAUTION]`.

> [!WARNING]
> Le marqueur doit être la première ligne de la citation.

### Listes

1. Numérotée
   - Imbriquée, à puces
   - [x] Les tâches peuvent être cochées
   - [ ] et décochées
2. Les listes peuvent contenir du code :

   ```sh
   npm run dev
   ```

### Tableau

| Gauche    | Centre  | Droite |
| :-------- | :-----: | -----: |
| Cellule   | Cellule |   1.00 |
| Plus long |  Texte  |  10.50 |

### Code

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### Mathématiques

En ligne $e^{i\pi} + 1 = 0$ et en bloc :

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

### Diagrammes

```mermaid
flowchart LR
    Open[Ouvrir un fichier] --> Edit[Modifier] --> Save[Enregistrer]
    Edit -->|Coller une image| Assets[(dossier assets)]
```

### Notes de bas de page

Une phrase avec une note[^1].

[^1]: Les notes sont listées à la fin du document.

<!-- Les commentaires sont conservés dans le fichier et affichés comme source. -->

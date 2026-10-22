# Pupitre ガイド

![Pupitre](./logo.svg)

Pupitre はデスクトップ向けの Markdown エディタです。ドキュメントは普通の `.md` ファイルで、見えているものはその場でレンダリングされ、カーソルがある間は Markdown の記法が表示されます。このガイドはエディタの表示例でもあります。自由に編集してください。**名前を付けて保存** を選ばない限り保存されません。

## 編集

**太字**、`コードスパン`、[リンク](https://github.com/shalemore/pupitre) の中にカーソルを置くと、周囲に記法が表示されます。記号はテキストと同じように扱えます。

- 開始記号のすぐ後ろで Backspace を押すと、書式が解除されます。
- 見出しの先頭で `#` を入力するとレベルが上がり、Backspace で下がります。
- 書式は **段落** メニューと **書式** メニュー、コンテキストメニュー、下記のショートカットから使えます。

<details>
<summary>キーボードショートカット(macOS では Ctrl が ⌘)</summary>

| 操作                                    | ショートカット                                                                                              |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| 太字 / 斜体 / インラインコード          | <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>Shift</kbd>+<kbd>`</kbd>                                 |
| 取り消し線                              | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>5</kbd>                                                                |
| リンク                                  | <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                                                |
| 見出し 1–6 / 段落                       | <kbd>Ctrl</kbd>+<kbd>1</kbd>…<kbd>6</kbd> / <kbd>0</kbd>                                                    |
| 引用                                    | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd>                                                               |
| 番号付きリスト / 箇条書き               | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>[</kbd> / <kbd>]</kbd>                                                |
| コードブロック / 数式ブロック           | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> / <kbd>M</kbd>                                                |
| 表                                      | <kbd>Ctrl</kbd>+<kbd>T</kbd>                                                                                |
| 検索 / 置換                             | <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>Ctrl</kbd>+<kbd>H</kbd> (macOS: <kbd>⌘</kbd>+<kbd>⌥</kbd>+<kbd>F</kbd>) |
| アウトライン                            | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>                                                               |
| フォーカスモード / タイプライターモード | <kbd>F8</kbd> / <kbd>F9</kbd>                                                                               |
| ズームをリセット                        | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd>                                                               |
| 環境設定                                | <kbd>Ctrl</kbd>+<kbd>,</kbd>                                                                                |

</details>

## 執筆モード

- **フォーカスモード** は書いている段落以外を薄く表示します。
- **タイプライターモード** は書いている行をウィンドウの中央に保ちます。

どちらも **表示** メニューと 環境設定 › エディタ にあり、組み合わせて使えます。

## ウィンドウスタイル

環境設定 › 外観 › ウィンドウスタイル で **クラシック** と **没入型** を切り替えます。没入型ではドキュメントがウィンドウ内のカードに表示され、入力やスクロールを始めるとタイトルバーとアウトラインが退き、ポインターがウィンドウの上端または開始側の端に来ると戻ります。変更後に開くウィンドウから適用されます。

## ファイルと画像

- 環境設定 › Markdown で変更しない限り、Pupitre は開いたファイルの改行コードを保ちます。リスト、強調、コードフェンス、水平線を保存時にどう書くかもそこで設定します。
- 貼り付けた画像はドキュメントの隣のフォルダー(既定は `assets`、環境設定 › Markdown)に保存されます。まだ保存していないドキュメントでは画像をメモリに保持し、最初の保存時に書き出します。
- 環境設定 › 一般 › Markdown の既定のアプリ で、ファイルマネージャーから `.md` ファイルを Pupitre で開けるようになります。
- 設定は `settings.json` に保存され、環境設定 › 情報 でそのフォルダーを表示できます。既定値と異なる値だけが書き込まれ、読み取れない項目は他の項目に影響せず既定値に戻ります。

## テーマ

テーマはウィンドウ全体とドキュメントの見た目を決めます。環境設定 › 外観 に対応するカラースキームとともに一覧され、ダークモードには別のテーマを選べます。

テーマはアプリに同梱されています。各テーマは `src/renderer/themes/<name>/` フォルダーにある `index.css` で、フォルダー名がテーマ名です。テーマが使うフォントや画像は同じフォルダーに置き、相対 `url()` で参照します。

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

- 色は `--ui-*` トークン(面、テキスト、アクセント)とコード用の `--syntax-*` で設定します。既定値と全一覧は `src/renderer/app.css` と `pupitre` テーマにあります。
- 引用の縦線は `var(--alert-color, …)` を使い、アラートが色を保てるようにしてください。
- 本文のフォントサイズ、行間、コンテンツ幅はユーザーのもので常に優先されます。ドキュメント内のサイズには `em`、右から左のテキストが反転するよう `padding-inline-start` などの論理プロパティを使ってください。

## Markdown リファレンス

### テキスト

**太字**、_斜体_、~~取り消し線~~、`インラインコード`、[リンク](https://commonmark.org)、H<sub>2</sub>O、x<sup>2</sup>、<kbd>Esc</kbd>、<mark>ハイライト</mark>。インライン HTML は完全な要素のときにレンダリングされ、それ以外はソースとして表示されます。

> 引用。
>
> > 入れ子の引用。

> [!NOTE]
> GitHub アラート: `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]`。

> [!WARNING]
> マーカーは引用の最初の行に置く必要があります。

### リスト

1. 番号付き
   - 入れ子の箇条書き
   - [x] タスクはチェックでき
   - [ ] 外すこともできます
2. リストにはコードも入れられます:

   ```sh
   npm run dev
   ```

### 表

| 左     |   中央   |    右 |
| :----- | :------: | ----: |
| セル   |   セル   |  1.00 |
| 長めの | テキスト | 10.50 |

### コード

```typescript
function countWords(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  return [...segmenter.segment(text)].filter((part) => part.isWordLike).length;
}
```

### 数式

インライン $e^{i\pi} + 1 = 0$ とディスプレイ数式:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

### 図

```mermaid
flowchart LR
    Open[ファイルを開く] --> Edit[編集] --> Save[保存]
    Edit -->|画像を貼り付け| Assets[(assets フォルダー)]
```

### 脚注

脚注のある文[^1].

[^1]: 脚注はドキュメントの末尾に並びます。

<!-- コメントはファイルに残り、ソースとして表示されます。 -->

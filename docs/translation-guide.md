# Translating Pupitre

The dictionaries in `src/shared/i18n/locales/` are written by AI. The maintainers speak Simplified
Chinese and English; most languages have no native reviewer, so a plausible string is not evidence
that it is right. This file records how a translation is chosen, what to check and where the
answers came from, so the next person or model does not repeat a settled mistake.

## The one rule

**Do not translate from intuition, memory or probability.** For anything that is not an everyday
word (_open_, _file_, _cancel_, _save_), find a source first. If no source can be found:

- keep the wording that is already there, if it is not wrong;
- add a comment in the locale file with the doubt and the sources checked;
- do not invent a more native-sounding word to fill the gap.

A translation is accepted because a source supports it, not because it reads well to a model.
Prefer the existing, unremarkable word over a clever one. The bar for changing a term is higher
than the bar for keeping it.

## Where evidence comes from

Check in this order and stop at the first source that answers the question.

1. **The product's own UI in that language.** Windows, Microsoft 365, macOS, iOS, VS Code, GitHub,
   Chrome, Firefox, GNOME, KDE. A menu label in the real product is the strongest evidence for a
   menu label in this app.
2. **Vendor terminology and style guides.** Microsoft Terminology Collection, Microsoft
   localization style guides, Apple Style Guide, Google developer documentation style guide.
3. **Standards and language authorities.** Unicode, BCP 47/CLDR, W3C _Requirements for Chinese Text
   Layout_ (clreq), official punctuation standards, language academies and monolingual
   dictionaries.
4. **Established open-source localizations and community style guides.** VS Code language packs,
   GNOME, KDE, Mozilla, the Chinese copywriting guidelines. These show what developers actually see.
5. **Forums, social posts and blogs.** Useful to confirm that a word is used, never enough on its
   own, and never the first place to look.

A web search is not a source by itself. Open the page and quote the sentence. Search the exact term
in quotes together with a vendor or a dictionary. If the only hits are machine-translated pages,
the term is not established.

Standards bodies do not automatically win over usage. Developers write _token_, not _词元_; _词元_
is a recent coinage that sounds official by design rather than natural in UI text. Standards decide
punctuation and orthography; they do not decide which word a community uses for an API concept.
Usage decides that, and usage is measured in real products and real documentation.

## Modern and global by default

When two forms are both correct, take the modern one that works across platforms and languages:

- Use the single ellipsis character `…` (U+2026) in every UI label, including Japanese, Chinese and
  Korean, rather than three ASCII periods or a doubled `……`. Japanese prose has its own conventions;
  a menu item does not need them, and `…` is what platform menus use.
- Use Western digits (`0–9`, U+0030–U+0039) in counts, versions and shortcut labels. Unicode lists
  Western, Latin and European digits as names for the same range; local digit forms belong in prose
  only where the platform UI itself uses them. [Unicode terminology](https://www.unicode.org/terminology/digits.html)
- Keep globally understood symbols and units unchanged: `%`, `MiB`, `PDF`, `Ctrl`, `⌘`, `⌥`, `/`,
  `›`. Do not replace a path separator or a key name with a local word.
- Prefer one shared term across products and platforms when the local alternatives mean the same
  thing. A reader who uses three apps should not have to learn three words for one control.
- Do not choose an older or more decorative local form just because it exists. Standard, modern and
  clear wins.
- This never overrides correctness. If the global form is ambiguous or wrong in a language, use the
  local one and record why.

## Before changing an existing string

- Is the current text actually wrong, or only less elegant? If it is not wrong, leave it.
- Is the new term used by at least one major product or dictionary in that language?
- Does it fit the space, the part of speech and the surrounding sentences?
- Does it keep the same meaning, not just the same topic?
- Is the change consistent everywhere the same concept appears?

Record the reason in a comment only when the choice is non-obvious or was disputed. Do not comment
obvious pairs such as _open_ ↔ 打开 or _file_ ↔ 文件; that only adds noise. A rule that applies to
every language belongs in this file, not in thirty locale files.

## Shared glossary

These are the terms already settled for this app. The source is the reason the row exists; do not
"improve" a row without a better source.

| English             | zh-CN                          | zh-HK                                    | zh-TW                                    | Key and evidence                                                                                                                                                                                                                                                                                                                                              |
| :------------------ | :----------------------------- | :--------------------------------------- | :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| global (scope)      | 全局                           | 全域                                     | 全域                                     | `settings.scopeGlobal`, `settings.scopeFolder`; Microsoft terminology: `global → 全域 [HKG, TWN]`, `全局 [CHN]`. [^1], [Microsoft zh-HK](https://support.microsoft.com/zh-hk/outlook/how-to-enable-global-and-advanced-logging-for-microsoft-outlook), [Apple zh-HK](https://support.apple.com/zh-hk/guide/deployment/dep7ba46fcd/web)                        |
| table row / column  | 行 / 列                        | 列 / 欄                                  | 列 / 欄                                  | `editor.table.insertRowAbove`, `editor.table.deleteColumn`, `editor.tableSize.rows`, `editor.tableSize.columns`; Excel in Hong Kong and Taiwan: [Microsoft zh-HK](https://support.microsoft.com/zh-hk/excel/change-the-column-width-and-row-height), [Microsoft zh-TW](https://support.microsoft.com/zh-tw/excel/change-the-column-width-and-row-height)      |
| word count          | 字 / 字数                      | 字 / 字數                                | 字 / 字數                                | `common.wordsCount`, `common.charsCount`, `settings.showWordCount`, `settings.showWordCountDesc`; Word and Pages say 字數 with 字元數 for characters: [Word zh-HK](https://support.microsoft.com/zh-hk/word/training/show-word-count), [Pages zh-HK](https://support.apple.com/zh-hk/guide/pages/tand47165437/mac). `text-stats.ts` counts each Han character |
| code                | 代码                           | 程式碼                                   | 程式碼                                   | `format.codeBlock`, `format.inlineCode`, `editor.codeLanguage`, `settings.codeFont`; [HKPUG glossary](https://www.hkpug.net/terminology/); Microsoft `program code → 程式碼 [HKG, TWN]` [^1]                                                                                                                                                                  |
| spell check         | 拼写检查                       | 拼字檢查                                 | 拼字檢查                                 | `settings.spellcheck`, `settings.spellcheckDesc`, `menu.addToDictionary`; Microsoft `Spell Check → 拼字檢查 [HKG, TWN]` [^1] [^1]                                                                                                                                                                                                                             |
| layout              | 布局                           | 版面配置                                 | 版面配置                                 | `settings.sidebarLayout`, `settings.sidebarLayoutDesc`; Microsoft `Layout → 版面配置 [HKG, TWN]` [^1] [^1]                                                                                                                                                                                                                                                    |
| pin (sidebar)       | 固定                           | 釘選                                     | 釘選                                     | `settings.pinSidebars`, `settings.pinSidebar`, `sidebar.pin`; Apple/macOS wording in Traditional Chinese                                                                                                                                                                                                                                                      |
| immersive           | 沉浸式                         | 沉浸式                                   | 沉浸式                                   | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; ja 没入型 (Apple Japan), ko 몰입형 (Microsoft Korea), is Umlykjandi, fa غوطه‌ور, uk Імерсивний (Microsoft terms) [^1]                                                                                                                                                                             |
| theme               | 主题                           | 主題                                     | 主題                                     | `settings.theme`, `settings.themeDefault`, `settings.darkTheme`; vi `Chủ đề`, not `giao diện`; [Microsoft vi-VN](https://support.microsoft.com/vi-vn/windows/experience/personalization/personalize-your-windows-experience-with-themes)                                                                                                                      |
| sidebar             | 侧边栏                         | 側邊欄                                   | 側邊欄                                   | `settings.sidebarLayout`, `settings.showOutline`, `welcome.lookImmersiveDesc`; da `sidepanel`, not `sidebjælke`; Microsoft Danish [^1]                                                                                                                                                                                                                        |
| move to trash       | 移到回收站                     | 移到垃圾桶                               | 移到資源回收筒                           | `sidebar.moveToTrash`; Windows CN/TW wording; Apple HK says 垃圾桶: [Apple zh-HK](https://support.apple.com/zh-hk/102610)                                                                                                                                                                                                                                     |
| GitHub alert labels | 注意/提示/重要/警告/注意       | 注意/提示/重要/警告/注意                 | 注意/提示/重要/警告/注意                 | `editor.alerts.note`, `editor.alerts.tip`, `editor.alerts.important`, `editor.alerts.warning`, `editor.alerts.caution`; GitHub's Chinese style guide renders NOTE and CAUTION both as 注意: [GitHub style guide](https://docs.github.com/zh/enterprise-cloud@latest/contributing/style-guide-and-content-model/style-guide)                                   |
| menu ellipsis       | …                              | …                                        | …                                        | `menu.openFile`, `menu.saveAs`, `quickOpen.placeholder`; U+2026 in UI labels in every language: [Microsoft Style Guide](https://learn.microsoft.com/style-guide/punctuation/ellipses), [VS Code zh-Hant](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-zh-hant/translations/main.i18n.json)                                     |
| Finder menu         | 显示简介 / 打开方式 / 全部更改 | 取得資料 / 開啟檔案的應用程式 / 全部更改 | 取得資訊 / 打開檔案的應用程式 / 更改全部 | `settings.defaultAppManual`; Apple's own localized pages: [Apple zh-HK](https://support.apple.com/zh-hk/guide/mac-help/mh35597/mac), [Apple zh-TW](https://support.apple.com/zh-tw/guide/mac-help/mh35597/mac)                                                                                                                                                |

Two rules that follow from the table:

- **Traditional Chinese is not Simplified Chinese with characters swapped.** Hong Kong and Taiwan
  use different words for the same control (全域 not 全局, 程式碼 not 代碼, 版面配置 not 佈局, 欄
  not 列). Machine conversion produces the wrong word with the right characters.
- **A term can be right in one region and wrong in another.** Check the region in the locale code,
  not just the script.

## Cases already settled

These are decisions, not a changelog. Every row was a real mistake or a real doubt in this
repository, and the right-hand column is what the evidence supports. Do not undo a row because
another word sounds more natural. If a row is wrong, bring a source stronger than the one listed,
change every occurrence, and update this table.

### `zh-CN`, `zh-HK`, `zh-TW`

| Locale                                 | Old / tempting                              | Use                                                | Key and evidence                                                                                                                                                                                                                                                                                                                                    |
| :------------------------------------- | :------------------------------------------ | :------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zh-HK` global scope                   | `全局`                                      | `全域`                                             | `settings.scopeGlobal`; Microsoft `global → 全域 [HKG, TWN]`; [Microsoft zh-HK](https://support.microsoft.com/zh-hk/outlook/how-to-enable-global-and-advanced-logging-for-microsoft-outlook); [Apple zh-HK](https://support.apple.com/zh-hk/guide/deployment/dep7ba46fcd/web)                                                                       |
| `zh-HK`, `zh-TW` table                 | `row` 行, `column` 列                       | `row` 列, `column` 欄                              | `editor.table.insertRowAbove`, `editor.table.deleteColumn`, `editor.tableSize.rows`, `editor.tableSize.columns`; [Microsoft zh-HK](https://support.microsoft.com/zh-hk/excel/change-the-column-width-and-row-height), [Microsoft zh-TW](https://support.microsoft.com/zh-tw/excel/change-the-column-width-and-row-height)                           |
| `zh-CN`, `zh-HK`, `zh-TW`              | `词/詞`, `词数/詞數`                        | `字`, `字数/字數`                                  | `common.wordsCount`, `common.charsCount`, `settings.showWordCount`, `settings.showWordCountDesc`; [Word zh-HK](https://support.microsoft.com/zh-hk/word/training/show-word-count), [Pages zh-HK](https://support.apple.com/zh-hk/guide/pages/tand47165437/mac); `text-stats.ts` counts each Han character as one word                               |
| `zh-HK`, `zh-TW` code                  | `代碼`                                      | `程式碼`                                           | `format.codeBlock`, `format.inlineCode`, `editor.codeLanguage`, `settings.codeFont`; [HKPUG glossary](https://www.hkpug.net/terminology/); Microsoft `program code → 程式碼 [HKG, TWN]` [^1]                                                                                                                                                        |
| `zh-HK` spell check                    | `拼寫檢查`                                  | `拼字檢查`                                         | `settings.spellcheck`, `settings.spellcheckDesc`, `menu.addToDictionary`; Microsoft `Spell Check → 拼字檢查 [HKG, TWN]`                                                                                                                                                                                                                             |
| `zh-HK` layout                         | `佈局`                                      | `版面配置`                                         | `settings.sidebarLayout`, `settings.sidebarLayoutDesc`; Microsoft `Layout → 版面配置 [HKG, TWN]`                                                                                                                                                                                                                                                    |
| `zh-HK` online docs                    | `網上文件`                                  | `線上文件`                                         | `menu.documentation`; Microsoft `online → 線上 [HKG, TWN]` [^1]                                                                                                                                                                                                                                                                                     |
| `zh-CN`, `zh-HK`, `zh-TW` alert labels | `NOTE` 註/備註, `CAUTION` 謹慎/小心/当心    | `注意`, `提示`, `重要`, `警告`, `注意`             | `editor.alerts.note`, `editor.alerts.tip`, `editor.alerts.important`, `editor.alerts.warning`, `editor.alerts.caution`; [GitHub style guide](https://docs.github.com/zh/enterprise-cloud@latest/contributing/style-guide-and-content-model/style-guide) renders NOTE and CAUTION both as 注意                                                       |
| `zh-CN` Finder                         | `Finder`                                    | `访达`, with `显示简介` / `打开方式` / `全部更改`  | `settings.defaultAppManual`; [Apple zh-CN](https://support.apple.com/zh-cn/guide/mac-help/mh35597/mac)                                                                                                                                                                                                                                              |
| `zh-HK` Finder                         | `顯示簡介`, `開啟方式`                      | `取得資料`, `開啟檔案的應用程式`, `全部更改`       | `settings.defaultAppManual`; [Apple zh-HK](https://support.apple.com/zh-hk/guide/mac-help/mh35597/mac)                                                                                                                                                                                                                                              |
| `zh-TW` Finder                         | `全部更改`                                  | `更改全部`, with `取得資訊` / `打開檔案的應用程式` | `settings.defaultAppManual`; [Apple zh-TW](https://support.apple.com/zh-tw/guide/mac-help/mh35597/mac)                                                                                                                                                                                                                                              |
| `zh-HK` trash                          | `回收站`                                    | `垃圾桶`                                           | `sidebar.moveToTrash`; [Apple zh-HK](https://support.apple.com/zh-hk/102610)                                                                                                                                                                                                                                                                        |
| `zh-HK`, `zh-TW` contents              | `標題清單`                                  | `目錄`                                             | `format.toc`; [Word zh-HK](https://support.microsoft.com/zh-hk/word/training/insert-a-table-of-contents)                                                                                                                                                                                                                                            |
| `zh-CN` compact label                  | `重命名 / 另存为` (spaces inside the label) | `重命名/另存为`                                    | `editor.imageFile.saveAs`; [GB/T 15834](https://people.ubuntu.com/~happyaron/l10n/GB%28T%2915834-2011.html); the app already writes `显示/隐藏侧边栏`                                                                                                                                                                                               |
| UI labels, every locale                | `...` or `……`                               | `…`                                                | `menu.openFile`, `menu.saveAs`, `quickOpen.placeholder`; [Microsoft Style Guide](https://learn.microsoft.com/style-guide/punctuation/ellipses), [VS Code zh-Hant](https://github.com/microsoft/vscode-loc/blob/main/i18n/vscode-language-pack-zh-hant/translations/main.i18n.json); the Smart Dashes example keeps the literal `...` the user types |

### Other languages

| Locale                  | Old / tempting                              | Use                                                        | Key and evidence                                                                                                                                                                                                |
| :---------------------- | :------------------------------------------ | :--------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ja` immersive          | `イマーシブ`                                | `没入型`                                                   | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; [Apple ja-JP](https://support.apple.com/ja-jp/guide/final-cut-pro/verdad9a56bb/mac)                                                                |
| `ja` UI ellipsis        | `……`                                        | `…`                                                        | `menu.openFile`, `menu.saveAs`; The same global UI convention as above                                                                                                                                          |
| `ko` color scheme       | `화면 모드`                                 | `색 구성표`                                                | `settings.colorScheme`, `settings.darkThemeDesc`; [Microsoft ko-KR](https://learn.microsoft.com/ko-kr/windows/terminal/customize-settings/color-schemes)                                                        |
| `vi` theme              | `giao diện` (the interface)                 | `Chủ đề`                                                   | `settings.themeDefault`, `settings.sameTheme`, `settings.exportDesc`; [Microsoft vi-VN](https://support.microsoft.com/vi-vn/windows/experience/personalization/personalize-your-windows-experience-with-themes) |
| `is` immersive          | `Yfirgripsmikill` (comprehensive)           | `Umlykjandi`                                               | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; [^1]                                                                                                                                               |
| `is` syntax             | `táknmál` (sign language)                   | `málskipan`                                                | `settings.sampleDocDesc`, `samples/documents/is-IS.md`; [Táknmál](https://is.wikipedia.org/wiki/T%C3%A1knm%C3%A1l)                                                                                              |
| `is` chemical equations | `Efnaformúlur`                              | `Efnajöfnur`                                               | `samples/documents/is-IS.md`; [Efnajafna](https://is.wikipedia.org/wiki/Efnajafna)                                                                                                                              |
| `ar` global scope       | `شامل` (comprehensive)                      | `عمومي`                                                    | `settings.scopeGlobal`; [^1]                                                                                                                                                                                    |
| `ar`, `fa` image align  | English visual left/right                   | `alignLeft` is the start, which is the right in RTL        | `imageStyle` uses `margin-inline`; the CSS mirrors the icons                                                                                                                                                    |
| `fa` immersive          | `فراگیر` (pervasive)                        | `غوطه‌ور`                                                   | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; [غوطه‌وری](https://fa.wikipedia.org/wiki/غوطه‌وری)                                                                                                   |
| `uk` immersive          | `Занурювальний`                             | `Імерсивний`                                               | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; [^1]                                                                                                                                               |
| `uk` title bar          | `Заголовок вікна`                           | `Рядок заголовка`                                          | `welcome.lookImmersiveDesc`, `welcome.lookClassicDesc`; [^1]                                                                                                                                                    |
| `da` sidebar            | `sidebjælke`                                | `sidepanel`                                                | `settings.sidebarLayout`, `settings.pinSidebars`, `settings.pinSidebarsDesc`; [^1]                                                                                                                              |
| `fi` title bar          | `otsikkopalkki`                             | `otsikkorivi`                                              | `welcome.lookImmersiveDesc`, `welcome.lookClassicDesc`; Both exist in Microsoft terminology; one term is kept throughout                                                                                        |
| `de` code fence         | `Umgrenzter Codeblock`                      | `Codezaun`                                                 | `settings.fenceMarker`; [Microsoft de-DE](https://learn.microsoft.com/de-de/powershell/scripting/community/contributing/powershell-style-guide)                                                                 |
| `de` pinned sidebar     | `Die Anheftung … sie`                       | `Das Anheften … deren Breite`                              | `samples/documents/de-DE.md`; The pronoun had two possible antecedents                                                                                                                                          |
| `sv` title bar          | `Namnlisten`                                | `Titelraden`                                               | `welcome.lookImmersiveDesc`, `welcome.lookClassicDesc`; Both appear in Microsoft Swedish; one term is kept throughout                                                                                           |
| `sv` edge               | `ett sidofälts kant`                        | `kanten på ett sidofält`                                   | `samples/documents/sv-SE.md`; Natural genitive instead of a stacked one                                                                                                                                         |
| `nl` pinned sidebar     | `De pin`                                    | `Het vastzetten`                                           | `samples/documents/nl-NL.md`; The locale already says `vastzetten`; `pin` is an English loan                                                                                                                    |
| `pt-PT` edge            | `margem`                                    | `borda`                                                    | `samples/documents/pt-PT.md`; `margem` is a page margin, not a control edge                                                                                                                                     |
| `es`, `pt`, `it` reset  | `el global` / `o global` / `quello globale` | `el valor global` / `o valor global` / `il valore globale` | `samples/documents/es-ES.md`, `samples/documents/pt-BR.md`, `samples/documents/pt-PT.md`, `samples/documents/it-IT.md`; The noun was missing                                                                    |
| `fr` reset              | `rend`                                      | `rétablit`                                                 | `samples/documents/fr-FR.md`; Collocation: a reset restores a value                                                                                                                                             |
| `fr` punctuation        | a normal space before `?`                   | U+00A0 before `?`                                          | `dialogs.encodingMessage`; French typography                                                                                                                                                                    |
| `it` toggle             | `da … a …`                                  | `tra … e …`                                                | `samples/documents/it-IT.md`; The control switches both ways                                                                                                                                                    |
| `th` immersive          | `เต็มหน้าจอ` (full screen)                    | `ดื่มด่ำ`                                                     | `settings.windowStyleImmersive`, `settings.pinSidebarsDesc`; No settled vendor term; the label is a choice, not a standard                                                                                      |
| `th` sample             | `กรอบการ์ด` / `ซ่อนไป`                        | `การ์ด` / `ถูกซ่อน`                                           | `samples/documents/th-TH.md`; Redundancy and passive voice                                                                                                                                                      |
| `hi` context menu       | `कॉन्टेक्स्ट मेन्यू`                               | `संदर्भ मेन्यू`                                                 | `samples/documents/hi-IN.md`; Hindi technical usage                                                                                                                                                             |
| `hi` pointer            | `सूचक`                                       | `पॉइंटर`                                                    | `samples/documents/hi-IN.md`; `सूचक` is an indicator, not the mouse pointer                                                                                                                                      |
| `hi` hide               | `किनारे हो जाते हैं`                            | `छिप जाते हैं`                                                | `welcome.lookImmersiveDesc`, `samples/documents/hi-IN.md`; The bars hide, they do not step aside                                                                                                                |
| `id` sample             | `Pin`                                       | `Menyematkan`                                              | `samples/documents/id-ID.md`; The locale already says `Sematkan`                                                                                                                                                |
| `vi` sample             | `Ghim trên thanh bên`                       | `Ghim thanh bên`                                           | `samples/documents/vi-VN.md`; “Pin on the sidebar” became “pin the sidebar”                                                                                                                                     |
| `el` outline            | `Διάρθρωση`                                 | `Περίγραμμα`                                               | `sidebar.outline`; Microsoft Greek                                                                                                                                                                              |
| `cs` update             | `stáhněte je`                               | `stáhněte ji`                                              | `settings.updateNotificationBody`; `aktualizace` is feminine                                                                                                                                                    |
| `tr` word               | `kelime`                                    | `sözcük`                                                   | `common.wordsCount`; TDK; consistency with the rest of the file                                                                                                                                                 |
| `tr` global             | `Genel`                                     | `Global`                                                   | `settings.scopeGlobal`; `Genel` is already General in the same window                                                                                                                                           |
| `tr` modified date      | `Değiştirme Tarihi`                         | `Değiştirilme Tarihi`                                      | `sidebar.sortModified`; The date something was modified                                                                                                                                                         |
| `ru` chemical equations | `формулы`                                   | `уравнения`                                                | `samples/documents/ru-RU.md`; [Химическое уравнение](https://ru.wikipedia.org/wiki/Химическое_уравнение)                                                                                                        |
| `pl` full width         | `Pełna`                                     | `Pełna szerokość`                                          | `settings.widthFull`; Clarity                                                                                                                                                                                   |
| `fi` sample             | `valitsin … välillä`                        | `Yleinen` / `Tämä kansio` -valitsin                        | `samples/documents/fi-FI.md`; The case pattern was incomplete                                                                                                                                                   |
| `da`, `nb` sample       | `giver den den` / `gir den den`             | `genskaber` / `gjenoppretter`                              | `samples/documents/da-DK.md`, `samples/documents/nb-NO.md`; Two pronouns in a row; the verb already means “gives back”                                                                                          |

### Wording, not terminology

These smaller repairs are easy to undo by accident:

- `任一個側邊` → `任一側`; the English is "either side", not "any one side edge".
- `取消這次還原` → `撤回這次還原`; undoing a restore cancels that restore.
- `只寫 [TOC]` → `只包含 [TOC]`; the paragraph contains the marker, it does not write it.
- `拖动侧边栏边缘` → `拖动侧边栏的边缘`; keep the possessive when it reads naturally.

### Advice that was checked and rejected

- “Change 没入型 to イマーシブ.” Rejected: Apple Japan uses 没入型 for immersive experience.
- “Use the local double ellipsis `……` in Japanese UI.” Rejected: menus use the single UI ellipsis.
- “Use 全局 in zh-HK because that is what people say.” Rejected for UI: Microsoft and Apple use
  全域 in Hong Kong. Colloquial speech is not the same register as a menu.
- “Use 词元 for token because a standards body says so.” Rejected: developers write token, and
  词元 is a recent coinage. Usage wins for community vocabulary; standards do not overrule it.
- “Give Thai and Vietnamese an official-sounding word for immersive.” Rejected: no settled term
  exists. Keep the understandable descriptive word and mark the gap instead of inventing authority.

## Script and punctuation

### `zh-CN`, `zh-HK`, `zh-TW`

- Put a space between Chinese characters and Latin letters or digits: `Markdown 文件`, `UTF-8 编码`,
  `20 MiB`. Do not remove those spaces when editing. Fullwidth punctuation takes no space.
  Background: [Chinese copywriting guidelines](https://github.com/sparanoid/chinese-copywriting-guidelines), [W3C clreq](https://www.w3.org/TR/clreq/).
- Use fullwidth punctuation inside Chinese sentences (`，。：；！？`), not ASCII punctuation.
- UI labels use one ellipsis character `…`. Prose uses the Chinese ellipsis `……`. The literal
  `--, --- and ...` in the Smart Dashes description is input the user types, so it stays three
  ASCII periods.
- A slash between two Chinese words takes no spaces in a compact label (`重命名/另存为`,
  `显示/隐藏侧边栏`). In a table or running prose, spaces around `/` are acceptable for
  readability; do not mix the two inside one label.
- Prefer verb–object and subject–verb–object sentences. Avoid Europeanized Chinese: chains of 的,
  passive 被 where Chinese would use an active verb, 进行 + noun, 一个 + noun, 对于/关于 openings,
  and 当……的时候 when a plain clause works.
- Do not invent a four-character idiom or a literary word for a button. Short and plain wins.

### Japanese

- No spaces between Japanese and Latin words.
- Keep the long vowel mark `ー` and the small kana `ャ ュ ョ ッ`; a missing `ー` changes the word
  (`タイトルバー`, not `タイトルバ`). Do not use halfwidth katakana.
- Use the katakana spelling the platform uses (`サイドバー`, `フォルダー`, `タイトルバー`).
- Prefer native Japanese where a natural word exists (`没入型`, `折りたたむ`) over a new
  transliteration. Do not replace an established native word with katakana just because it is
  closer to English.
- Use `。` and `、` in prose; menu labels take no final period.

### Korean

- Follow 띄어쓰기; do not glue a particle to the wrong word.
- Particles change with the final consonant: `을/를`, `이/가`, `은/는`, `과/와`. Check every
  inserted name or label (`Pupitre를`, `사이드바가`).
- Prefer established UI words over transliterations (`몰입형`, `사이드바`, `고정`) unless the
  product itself uses the English word.

### French

- A no-break space precedes `: ; ! ?` and sits inside `« »`: `Préférences :`, `« fichier »`.
  Use U+00A0, not a normal space, where the string allows it.
- Use the typographic apostrophe `’`, not `'`.
- Do not capitalize every noun the way English does.

### German

- Capitalize nouns. Use `„ “` for quotes and `ß` where the orthography requires it.
- Keep the register consistent. These dictionaries address the user as `Sie`.

### Other European languages

- Slavic languages (cs, pl, ru, uk): check case endings after prepositions and verbs. A label that
  works in the nominative may need the genitive or instrumental in a sentence.
- Romance languages (es, it, pt): check gender and number agreement, including articles and
  adjectives that refer to a label (`la valeur globale`, `il valore globale`).
- Turkish: dotted and dotless i (`İstanbul`, `için`); vowel harmony in suffixes.
- Finnish and Hungarian: case suffixes and consonant gradation; do not guess an ending.
- Icelandic: `þ`/`ð`, accents, and compound nouns; check the dictionary before writing a compound.
- Dutch and the Scandinavian languages: compound nouns are written as one word; check whether the
  compound is a real word rather than two nouns pushed together.

### Right-to-left (`ar`, `fa`)

- Use the language's own punctuation: Arabic comma `،`, semicolon `؛`, question mark `؟`.
- UI alignment follows the visual edge. The code's `alignLeft` means the inline start, which is the
  right side in RTL, so the Arabic and Persian labels say "right" and "left" accordingly. Do not
  "fix" them back to the English visual direction.
- Keep Latin file names, paths and code in Latin; the UI already wraps them with `dir="auto"` or
  `dir="ltr"` where needed. Do not insert bidi control characters into translated text.
- Use logical CSS properties in samples (`padding-inline-start`, not `padding-left`).

## What models get wrong

These are the failure modes seen in this repository, not hypothetical ones.

- **A plausible invented term.** `全域` was challenged, but Microsoft and Apple both use it in Hong
  Kong; `全局` is the zh-CN word. `Markdown-táknmál` read as "Markdown sign language" in Icelandic,
  where `málskipan` is syntax. `Yfirgripsmikill` means comprehensive, not immersive.
- **A correct word in the wrong region.** Readers in Hong Kong and Taiwan see 代码/代碼, 布局/佈局,
  行/列 and know the text was converted, not translated.
- **English word order with local words.** Chinese strings full of 的, 被, 进行 and 一个; Japanese
  strings that keep English clause order; German sentences with English commas.
- **Wrong inflection around an inserted name.** `${name}` can change the case, gender or particle
  of the words around it. Read the whole sentence with a real name in place.
- **Missing Japanese long vowels and small kana.** `バー` vs `バ`, `ション` vs `シヨン`.
- **A literal ellipsis or a missing space.** Three ASCII periods in a menu, `……` in a button, no
  space before Latin in Chinese, a normal space before `?` in French.
- **A changed token or style.** Markdown, HTML, `\ce`, `Pupitre` and keyboard keys stay as they are;
  quotes and dashes follow the language, not the English string.

## Tools

No tool can prove that a sentence means what the English means. These catch the mechanical layer:

- `npm run typecheck` and `npm test` — the dictionaries are typed by `TranslationSchema`; a missing
  key or a broken function fails the build. `src/shared/i18n/typography.test.ts` checks the two
  rules a machine can check: every UI ellipsis is U+2026, and Chinese keeps a space between Han and
  Latin letters or digits.
- `npm run lint` — formatting, lint rules and import order. It does not spell-check.
- CI runs `lint`, `typecheck`, `knip`, `test:coverage`, `build`, `check:bundle`, `test:e2e` and
  `build:web`. None of them spell-check a dictionary; spelling and grammar need the external tools
  below.
- [LanguageTool](https://languagetool.org/) — open-source grammar and style checker for many of
  these languages. It catches agreement, case and punctuation errors, not invented vocabulary.
- [Hunspell](https://hunspell.github.io/) dictionaries (the ones Firefox uses) — spelling.
- [textlint](https://textlint.github.io/) — Japanese prose rules, including punctuation and
  sentence length.
- [Vale](https://vale.sh/) — a style linter for prose, useful for English and for custom rules.
- [CLDR](https://cldr.unicode.org/) — plural rules, date and number formats; check a language's
  plural categories before writing a plural function.
- [Microsoft Terminology Collection](https://learn.microsoft.com/globalization/reference/microsoft-terminology)
  and [Microsoft style guides](https://learn.microsoft.com/globalization/reference/microsoft-style-guides).
- [Apple Style Guide](https://support.apple.com/guide/applestyleguide/welcome/web).
- [Google developer documentation style guide](https://developers.google.com/style).
- [VS Code language packs](https://github.com/microsoft/vscode-loc) — real UI strings in every
  supported language.
- [IATE](https://iate.europa.eu/) and [UNTERM](https://unterm.un.org/) — terminology for
  institutions and technical fields.
- Monolingual dictionaries and corpora: [Duden](https://www.duden.de/), [SAOL](https://svenska.se/),
  [RAE](https://www.rae.es/), [Priberam](https://www.priberam.pt/),
  [Treccani](https://www.treccani.it/vocabolario/), [DWDS](https://www.dwds.de/),
  [Czech National Corpus](https://www.korpus.cz/), [Korp](https://spraakbanken.gu.se/korp/),
  [Ordnet](https://ordnet.dk/), [Bokmålsordboka](https://ordbokene.no/),
  [Kielitoimiston sanakirja](https://www.kielitoimistonsanakirja.fi/), [Грамота](https://gramota.ru/),
  [Словник української мови](https://sum.in.ua/), [Słownik języka polskiego](https://sjp.pwn.pl/),
  [TDK](https://www.tdk.gov.tr/), [Málið](https://malid.is/),
  [Wiktionary](https://en.wiktionary.org/).
- [Google Books Ngram Viewer](https://books.google.com/ngrams) — how often a phrase actually occurs;
  weak for UI terms, useful for general vocabulary.

## Comments in locale files

Put a comment next to a string when the choice is disputed, regional, or could be "fixed" wrongly
by the next model. Keep it short and link the page that settled it. Leave obvious words alone.

```ts
// The zh-HK dictionary uses 全域 for "global", as Microsoft and Apple do:
// https://support.microsoft.com/zh-hk/outlook/how-to-enable-global-and-advanced-logging-for-microsoft-outlook
// https://support.apple.com/zh-hk/guide/deployment/dep7ba46fcd/web
scopeGlobal: "全域",
```

Do not paste the same long explanation into several locales. If the rule is shared, add it to this
file and point to it from the locale file in one line.

## Checklist before committing

- [ ] Every non-obvious term has a source, or the previous wording was kept.
- [ ] The region in the locale code matches the wording (zh-HK ≠ zh-TW ≠ zh-CN).
- [ ] The register (formal/informal), gender and case agree with the surrounding sentence.
- [ ] Chinese has spaces between Han and Latin/digits; French has no-break spaces; Japanese and
      Korean follow their own spacing.
- [ ] The only ASCII `...` left is the Smart Dashes input example; every other UI ellipsis is `…`.
- [ ] Quotes, dashes, commas and question marks are the language's own.
- [ ] `Pupitre`, file names, code, formats and keys are unchanged.
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass.

## Known gaps

- Thai and Vietnamese have no settled vendor term for "immersive". The descriptive word currently
  used is a choice, not a standard; do not claim otherwise.
- Hindi has little first-party Microsoft UI to check against; prefer common Devanagari technical
  usage over a literal translation.
- Icelandic, Greek, Czech, Danish and Finnish have good dictionaries but few UI corpora. Check the
  dictionary and the platform, and leave a comment when the evidence is thin.
- Where Microsoft and Apple disagree, follow the platform the string names; where the app names no
  platform, prefer the term shared by both.

[^1]: [Microsoft Terminology Collection](https://learn.microsoft.com/globalization/reference/microsoft-terminology)

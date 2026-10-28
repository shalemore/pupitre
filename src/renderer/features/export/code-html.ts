import { LanguageDescription } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import { codeHighlightStyle } from "@/features/editor/code-highlight";
import { codeLanguages } from "@/features/editor/code-languages";
import { escapeHtml } from "@/lib/html";

/**
 * Syntax highlighting of the code blocks of an exported page.
 *
 * The colors are the tags of the editor's own highlight style, so a block reads on the page as it
 * reads on the screen; its CSS classes are the ones page-style.ts writes into the page. The
 * language is found the way lang-markdown finds it for the editor, from the fence's info string
 * through the app's code languages, so a fence is colored on the page exactly when it is colored
 * in the window.
 */

/** The language description for what a fence names, or `null` for a language this app does not know. */
function languageOf(language: string): LanguageDescription | null {
  return language === ""
    ? null
    : LanguageDescription.matchLanguageName(codeLanguages, language, true);
}

/**
 * The tokens of a code block as `<span>`s, or `undefined` when nothing colors the block: an unknown
 * language, one that cannot be loaded and one the parser trips over all leave the text as it is.
 *
 * `language` is the word a fence names its language with, already taken off its info string the
 * way lang-markdown takes it.
 */
export async function codeHtml(code: string, language: string): Promise<string | undefined> {
  const description = languageOf(language);
  if (description === null) return undefined;
  try {
    const support = description.support ?? (await description.load());
    const tree = support.language.parser.parse(code);
    let html = "";
    let at = 0;
    highlightTree(tree, codeHighlightStyle, (from, to, classes) => {
      html += escapeHtml(code.slice(at, from));
      html += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`;
      at = to;
    });
    return html + escapeHtml(code.slice(at));
  } catch {
    return undefined;
  }
}

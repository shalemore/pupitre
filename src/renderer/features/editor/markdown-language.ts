import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM, Subscript, Superscript } from "@lezer/markdown";
import { emojiSyntax } from "./emoji";
import { footnotes } from "./footnotes";
import { frontMatter } from "./front-matter";
import { highlight } from "./highlight";
import { math } from "./math";

/**
 * The Markdown syntax of the editor. Everything that reads the document goes through this one
 * Lezer tree, so text that is not being edited — a selection copied out as HTML, for one — is
 * read with the same nodes by asking for this extension alone.
 */
export const markdownLanguage = markdown({
  base: commonmarkLanguage,
  extensions: [GFM, Subscript, Superscript, emojiSyntax, highlight, frontMatter, math, footnotes],
  codeLanguages: languages,
  completeHTMLTags: false,
});

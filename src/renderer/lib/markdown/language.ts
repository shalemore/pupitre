import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { GFM, parser, Subscript, Superscript, type MarkdownExtension } from "@lezer/markdown";
import { cjkAutolink } from "./autolink";
import { codeLanguages } from "./code-languages";
import { emojiSyntax } from "./emoji";
import { footnotes } from "./footnotes";
import { frontMatter } from "./front-matter";
import { highlight } from "./highlight";
import { math } from "./math";

/** How long a full parse may take before a render keeps what it has. */
export const FULL_PARSE_TIMEOUT_MS = 5000;

const extensions: MarkdownExtension[] = [
  GFM,
  Subscript,
  Superscript,
  emojiSyntax,
  highlight,
  frontMatter,
  math,
  footnotes,
  cjkAutolink,
];

/** The editor's Markdown syntax without CodeMirror, for reading text outside it. */
export const markdownParser = parser.configure(extensions);

/**
 * The Markdown syntax of the editor. Everything that reads the document goes through this one
 * Lezer tree, so text that is not being edited — a selection copied out as HTML, for one — is
 * read with the same nodes by asking for this extension alone.
 */
export const markdownLanguage = markdown({
  base: commonmarkLanguage,
  extensions,
  codeLanguages,
  completeHTMLTags: false,
});

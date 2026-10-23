import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { gfm } from "@joplin/turndown-plugin-gfm";
import TurndownService from "turndown";
import type { MarkdownStyle } from "./format-commands";

/**
 * Rich text pasted from a browser or a word processor is converted to Markdown with Turndown, so
 * the document stays Markdown source, written in the user's Markdown style. Plain text, text from
 * code editors and anything pasted into a code block is inserted as it is.
 */

/** Clipboard formats of code editors, whose HTML only colors the code. */
const CODE_EDITOR_FORMATS = ["vscode-editor-data"];

function toMarkdown(html: string, style: MarkdownStyle): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: style.bulletMarker,
    emDelimiter: style.emphasisMarker === "_" ? "_" : "*",
    strongDelimiter: style.strongMarker === "_" ? "__" : "**",
    codeBlockStyle: "fenced",
    fence: style.fenceMarker === "~" ? "~~~" : "```",
    hr: style.ruleMarker.repeat(3),
  });
  turndown.use(gfm);
  // Turndown pads list markers to four columns ("-   item"); write them the way people type them
  turndown.addRule("listItem", {
    filter: "li",
    replacement(content, node) {
      const list = node.parentElement;
      const start = Number(list?.getAttribute("start") ?? 1);
      const index = list ? [...list.children].indexOf(node) : 0;
      const marker = list?.nodeName === "OL" ? `${start + index}. ` : `${style.bulletMarker} `;
      const body = content.trim().replaceAll("\n", `\n${" ".repeat(marker.length)}`);
      return `${marker}${body}${node.nextElementSibling ? "\n" : ""}`;
    },
  });
  // Office and browsers wrap the fragment in markup that has no Markdown meaning
  turndown.remove(["style", "script", "meta", "title"]);
  return turndown.turndown(html).trim();
}

function inCode(view: EditorView): boolean {
  const { head } = view.state.selection.main;
  for (let node = syntaxTree(view.state).resolveInner(head, -1); node.parent; node = node.parent) {
    if (/^(?:FencedCode|CodeBlock|InlineCode|BlockMath|InlineMath)$/.test(node.name)) return true;
  }
  return false;
}

export function pasteHtml(style: () => MarkdownStyle): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const data = event.clipboardData;
      const html = data?.getData("text/html");
      if (!data || !html || CODE_EDITOR_FORMATS.some((type) => data.types.includes(type))) {
        return false;
      }
      if (inCode(view)) return false;
      const markdown = toMarkdown(html, style());
      if (markdown === "") return false;
      event.preventDefault();
      view.dispatch(view.state.replaceSelection(markdown), {
        scrollIntoView: true,
        userEvent: "input.paste",
      });
      return true;
    },
  });
}

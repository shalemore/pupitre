import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { DOCUMENT_EXTENSIONS } from "@shared/desktop-api";
import { desktop } from "@/lib/desktop";
import { pathFromFileUrl } from "@/lib/file";
import { documentBaseUrl } from "@/lib/markdown/images";
import { collectHeadings, findHeadingByAnchor } from "@/lib/markdown/structure";
import { scrollToDocument } from "./scroll";

/**
 * Following a link in the document: web and mail addresses open in the browser, an anchor scrolls
 * to its heading, and a Markdown file next to the document opens in the window.
 */

/** The address of the link at `pos`. */
export function linkAt(state: EditorState, pos: number): string | undefined {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    const url = node.name === "URL" ? node : node.getChild("URL");
    if (url) return state.sliceDoc(url.from, url.to);
  }
  return undefined;
}

/** Opens web and mail links in the system browser; returns false for other addresses. */
export function openLink(href: string): boolean {
  if (!/^(?:https?|mailto):/i.test(href)) return false;
  window.open(href);
  return true;
}

/** A link to a document next to this one, which the window opens in place. */
const DOCUMENT_LINK = new RegExp(`^[^:]+\\.(?:${DOCUMENT_EXTENSIONS.join("|")})(?:#.*)?$`, "i");

/**
 * Follows a link: web addresses open in the browser, `#anchors` scroll to their heading and
 * Markdown files next to the document open in the window.
 */
export function followLink(view: EditorView, href: string): boolean {
  if (openLink(href)) return true;
  if (href.startsWith("#")) {
    const heading = findHeadingByAnchor(collectHeadings(view.state), href.slice(1));
    if (!heading) return false;
    view.dispatch({ selection: { anchor: heading.pos } });
    scrollToDocument(view, heading.pos);
    return true;
  }
  const base = view.state.facet(documentBaseUrl);
  if (!base || !DOCUMENT_LINK.test(href)) return false;
  const path = pathFromFileUrl(new URL(href, base));
  void desktop.invoke("app:dispatch", { id: "file.open-path", path });
  return true;
}

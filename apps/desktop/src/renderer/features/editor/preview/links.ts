import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { DOCUMENT_EXTENSIONS } from "@pupitre/desktop-api";
import { desktop } from "@pupitre/desktop-api/client";
import {
  autolinkDestination,
  collectHeadings,
  documentBaseUrl,
  findHeadingByAnchor,
  referenceTarget,
} from "@pupitre/markdown";
import { pathFromFileUrl } from "@pupitre/utils";
import { scrollToDocument } from "@/features/editor/scroll";

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
    if (node.name === "URL") {
      const written = state.sliceDoc(node.from, node.to);
      const parent = node.parent?.name;
      // A bare address is an autolink; a link's own destination is used as written
      return parent === "Link" || parent === "Image" ? written : autolinkDestination(written);
    }
    if (node.name === "Autolink") {
      const url = node.getChild("URL");
      return url === null ? undefined : autolinkDestination(state.sliceDoc(url.from, url.to));
    }
    const url = node.getChild("URL");
    if (url) return state.sliceDoc(url.from, url.to);
    if (node.name === "Link") {
      const [open, close] = node.getChildren("LinkMark");
      const target = open && close ? referenceTarget(state, node, open.to, close.from) : undefined;
      if (target !== undefined) return target.href;
    }
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

import type { SyntaxNode } from "@lezer/common";

/** The syntax markers directly inside an inline format, such as `**` or `[` and `]`. */
export function markers(node: SyntaxNode): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name.endsWith("Mark")) found.push(child);
  }
  return found;
}

/** Rendered formulas by display mode and source; widgets are rebuilt while scrolling and editing. */
const cache = new Map<string, Promise<string>>();

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * The SVG of a formula, rendered once per source by mathjax-document, which is imported the first
 * time a formula shows up. MathJax draws malformed TeX in place, in red; only a renderer that
 * failed to load falls back to the source here.
 */
export function renderMath(tex: string, display: boolean): Promise<string> {
  const key = `${display ? "display" : "inline"}\n${tex}`;
  let svg = cache.get(key);
  if (svg === undefined) {
    svg = import("./mathjax-document")
      .then(({ texToSvg }) => texToSvg(tex, display))
      .catch(() => `<span class="md-math-error">${escapeHtml(tex)}</span>`);
    cache.set(key, svg);
  }
  return svg;
}

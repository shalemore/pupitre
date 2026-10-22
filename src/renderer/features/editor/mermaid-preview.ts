let renderCount = 0;

/**
 * Preview callback for Crepe code blocks: handles only mermaid; returning undefined means rendering is asynchronous and the result is filled in through apply.
 * Mermaid is large, so it is loaded the first time a diagram is met.
 */
export function renderMermaidPreview(
  language: string,
  content: string,
  apply: (value: string | HTMLElement | null) => void,
): null | undefined {
  if (language.toLowerCase() !== "mermaid" || !content.trim()) return null;

  void (async () => {
    const { default: mermaid } = await import("mermaid");
    const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
    mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default" });
    try {
      const { svg } = await mermaid.render(`mermaid-preview-${renderCount++}`, content);
      // A string would be filtered by Crepe with DOMPurify, which drops the label text inside foreignObject;
      // Mermaid's default strict security level has already sanitized the input, so its generated SVG is handed over directly
      const container = document.createElement("div");
      container.className = "mermaid-diagram";
      container.innerHTML = svg;
      apply(container);
    } catch (error) {
      const message = document.createElement("pre");
      message.className = "mermaid-error";
      message.textContent = error instanceof Error ? error.message : String(error);
      apply(message);
    }
  })();
  return undefined;
}

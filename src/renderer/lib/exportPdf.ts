import { marked } from "marked";
import { desktop } from "@/lib/desktop";

/**
 * The editor only renders the lines in view and cannot be printed directly, so the Markdown is converted to HTML and put into
 * a container that is visible only when printing (styles in `@media print` of app.css), then handed to the main process's printToPDF.
 */
export async function exportMarkdownToPdf(markdown: string, fileName: string): Promise<void> {
  const container = document.createElement("article");
  container.className = "print-document";
  container.innerHTML = await marked.parse(markdown, { gfm: true });
  document.body.append(container);
  try {
    await Promise.all(
      [...container.querySelectorAll("img")].map((img) => img.decode().catch(() => {})),
    );
    await desktop.invoke(
      "document:export-pdf",
      fileName.replace(/\.(md|markdown|mdown|txt)$/i, ".pdf"),
    );
  } finally {
    container.remove();
  }
}

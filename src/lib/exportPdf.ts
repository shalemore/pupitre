import html2pdf from "html2pdf.js";
import { marked } from "marked";
import { isTauri } from "@/lib/platform";

const PDF_STYLES = `
.pupitre-pdf-sheet {
  box-sizing: border-box;
  width: 794px;
  padding: 36px 44px;
  background-color: #ffffff;
  color: #1f2328;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}
.pupitre-pdf-sheet h1,
.pupitre-pdf-sheet h2,
.pupitre-pdf-sheet h3,
.pupitre-pdf-sheet h4,
.pupitre-pdf-sheet h5,
.pupitre-pdf-sheet h6 {
  color: #1f2328;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 24px;
  margin-bottom: 12px;
  page-break-after: avoid;
  break-after: avoid;
}
.pupitre-pdf-sheet h1 {
  font-size: 24px;
  padding-bottom: 8px;
  border-bottom: 1px solid #d0d7de;
}
.pupitre-pdf-sheet h2 {
  font-size: 19px;
  padding-bottom: 6px;
  border-bottom: 1px solid #d0d7de;
}
.pupitre-pdf-sheet h3 {
  font-size: 16px;
}
.pupitre-pdf-sheet h4 {
  font-size: 14px;
}
.pupitre-pdf-sheet p,
.pupitre-pdf-sheet blockquote,
.pupitre-pdf-sheet ul,
.pupitre-pdf-sheet ol,
.pupitre-pdf-sheet table,
.pupitre-pdf-sheet pre {
  margin-top: 0;
  margin-bottom: 14px;
}
.pupitre-pdf-sheet ul,
.pupitre-pdf-sheet ol {
  padding-left: 24px;
}
.pupitre-pdf-sheet li {
  margin-bottom: 3px;
}
.pupitre-pdf-sheet li > p {
  margin-bottom: 3px;
}
.pupitre-pdf-sheet blockquote {
  padding: 6px 14px;
  color: #57606a;
  border-left: 4px solid #d0d7de;
  background-color: #f6f8fa;
  border-radius: 0 4px 4px 0;
  page-break-inside: avoid;
  break-inside: avoid;
}
.pupitre-pdf-sheet hr {
  height: 2px;
  padding: 0;
  margin: 20px 0;
  background-color: #d0d7de;
  border: 0;
}
.pupitre-pdf-sheet pre {
  padding: 12px 14px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.45;
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  direction: ltr;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-all;
  page-break-inside: avoid;
  break-inside: avoid;
}
.pupitre-pdf-sheet code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 85%;
  direction: ltr;
  unicode-bidi: isolate;
}
.pupitre-pdf-sheet :not(pre) > code {
  padding: 0.2em 0.4em;
  margin: 0;
  background-color: #eff1f3;
  border-radius: 4px;
  border: 1px solid #e1e4e8;
}
.pupitre-pdf-sheet table {
  border-collapse: collapse;
  width: 100%;
  display: table;
  page-break-inside: avoid;
  break-inside: avoid;
  font-size: 13px;
  margin-bottom: 14px;
}
.pupitre-pdf-sheet table th,
.pupitre-pdf-sheet table td {
  padding: 7px 10px;
  border: 1px solid #d0d7de;
}
.pupitre-pdf-sheet table th {
  font-weight: 600;
  background-color: #f6f8fa;
}
.pupitre-pdf-sheet table tr:nth-child(2n) {
  background-color: #fafbfc;
}
.pupitre-pdf-sheet img {
  max-width: 100%;
  box-sizing: border-box;
  page-break-inside: avoid;
  break-inside: avoid;
  border-radius: 4px;
}
.pupitre-pdf-sheet a {
  color: #0969da;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.pupitre-pdf-sheet input[type="checkbox"] {
  margin-right: 6px;
  vertical-align: middle;
}
`;

function getPdfDefaultName(suggestedFileName?: string | null): string {
  if (!suggestedFileName) {
    return "document.pdf";
  }
  const base = suggestedFileName.replace(/\.(md|markdown|txt)$/i, "");
  return `${base}.pdf`;
}

export async function exportMarkdownToPdf(
  markdown: string,
  suggestedFileName?: string | null,
): Promise<boolean> {
  const fileName = getPdfDefaultName(suggestedFileName);

  let targetTauriPath: string | null = null;
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const selected = await save({
      filters: [
        {
          name: "PDF Document",
          extensions: ["pdf"],
        },
      ],
      defaultPath: fileName,
    });

    if (!selected || typeof selected !== "string") {
      return false;
    }
    targetTauriPath = selected;
  }

  const container = document.createElement("div");
  container.className = "pupitre-pdf-sheet";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-9999";

  const styleEl = document.createElement("style");
  styleEl.textContent = PDF_STYLES;
  container.appendChild(styleEl);

  const contentEl = document.createElement("div");
  const parsedHtml = await marked.parse(markdown, { gfm: true });
  contentEl.innerHTML = parsedHtml;
  container.appendChild(contentEl);

  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }
            }),
        ),
      );
    }

    const opt = {
      margin: [12, 12, 14, 12] as [number, number, number, number],
      filename: fileName,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait" as const,
      },
      pagebreak: {
        mode: ["avoid-all", "css", "legacy"],
      },
    };

    if (isTauri() && targetTauriPath) {
      const worker = html2pdf().from(container).set(opt);
      const buffer = (await worker.output("arraybuffer")) as ArrayBuffer;
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      await writeFile(targetTauriPath, new Uint8Array(buffer));
      return true;
    }

    await html2pdf().from(container).set(opt).save(fileName);
    return true;
  } catch (error) {
    console.error("Failed to export PDF:", error);
    return false;
  } finally {
    container.remove();
  }
}

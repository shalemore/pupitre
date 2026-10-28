import { describe, expect, it } from "vitest";
import { HtmlBlockWidget, isRenderableHtml } from "./html";
import { markdownView } from "./testing";

describe("the HTML blocks the editor shows rendered", () => {
  it("renders an element whose content stays visible", () => {
    expect(isRenderableHtml('<div class="note">\nhi\n</div>')).toBe(true);
    expect(isRenderableHtml('<img src="picture.png">')).toBe(true);
    expect(isRenderableHtml("<table>\n<tr><td>a</td></tr>\n</table>")).toBe(true);
    expect(isRenderableHtml("<DIV>hi</DIV>")).toBe(true);
  });

  it("keeps the source of an element whose content the sanitizer drops", () => {
    // Rendering these would hide the source behind nothing; an unclosed <script> or <style> runs
    // to the end of the document, so the whole rest of the file would go
    for (const tag of [
      "head",
      "iframe",
      "noembed",
      "noframes",
      "noscript",
      "plaintext",
      "script",
      "style",
      "template",
      "title",
      "xmp",
    ]) {
      expect(isRenderableHtml(`<${tag}>\nA window takes the focus\n`)).toBe(false);
      expect(isRenderableHtml(`<${tag}>alert(1)</${tag}>`)).toBe(false);
    }
  });

  it("keeps the source of what opens no element", () => {
    expect(isRenderableHtml("<!-- a comment -->")).toBe(false);
    expect(isRenderableHtml("</div>")).toBe(false);
  });

  it("leaves a details section to its own rule", () => {
    expect(isRenderableHtml("<details>\n<summary>More</summary>\ntext\n</details>")).toBe(false);
    expect(isRenderableHtml("<details open>")).toBe(false);
  });

  it("gives links in an HTML block the document's link class", () => {
    const view = markdownView("");
    const block = new HtmlBlockWidget(
      '<p><a href="https://example.com">site</a></p>',
      undefined,
    ).toDOM(view);
    expect(block.querySelector("a")?.classList.contains("md-link")).toBe(true);
    view.destroy();
  });
});

import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { closeInlineTags, HtmlBlockWidget, isRenderableHtml } from "./html";
import { markdownView, marked } from "./testing";

/** Types `text` the way CodeMirror does: the first input handler that takes it decides. */
function type(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main;
  const insert = () =>
    view.state.update({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
  const handled = view.state
    .facet(EditorView.inputHandler)
    .some((handler) => handler(view, from, to, text, insert));
  if (!handled) view.dispatch(insert());
}

describe("closing a tag while it is typed", () => {
  function closed(before: string): string {
    const view = markdownView(before, [closeInlineTags()]);
    type(view, ">");
    const result = marked(view);
    view.destroy();
    return result;
  }

  it("closes inline, unknown and block tags", () => {
    expect(closed("<sub|")).toBe("<sub>|</sub>");
    expect(closed("<sup|")).toBe("<sup>|</sup>");
    expect(closed("<span|")).toBe("<span>|</span>");
    expect(closed("<div|")).toBe("<div>|</div>");
  });

  it("leaves tags that take no closing tag alone", () => {
    expect(closed("<br|")).toBe("<br>|");
    expect(closed('<img src="x"|')).toBe('<img src="x">|');
    expect(closed("<hr/|")).toBe("<hr/>|");
  });

  it("leaves what Markdown writes with angle brackets alone", () => {
    expect(closed("<https://example.com|")).toBe("<https://example.com>|");
    expect(closed("<user@example.com|")).toBe("<user@example.com>|");
    expect(closed("[x](<sub|)")).toBe("[x](<sub>|)");
    expect(closed("`<sub|`")).toBe("`<sub>|`");
    expect(closed("$a<b$|")).toBe("$a<b$>|");
  });

  it("does not close a tag whose closing tag already follows", () => {
    expect(closed("<sub|</sub>")).toBe("<sub>|</sub>");
  });

  it("waits for a quoted attribute to close", () => {
    const view = markdownView('<sub data-x="|"', [closeInlineTags()]);
    type(view, ">");
    expect(marked(view)).toBe('<sub data-x=">|"');
    view.destroy();
  });
});

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

  it("gives the inline formats the classes their Markdown spellings use", () => {
    const view = markdownView("");
    const block = new HtmlBlockWidget(
      "<p><b>bold</b> <em>italic</em> <del>gone</del> <code>x</code> <kbd>Ctrl</kbd> <mark>hi</mark></p>",
      undefined,
    ).toDOM(view);
    expect(block.querySelector("b")?.className).toBe("md-tag md-tag-b md-strong");
    expect(block.querySelector("em")?.className).toBe("md-tag md-tag-em md-em");
    expect(block.querySelector("del")?.className).toBe("md-tag md-tag-del md-strike");
    expect(block.querySelector("code")?.className).toBe("md-tag md-tag-code md-code");
    expect(block.querySelector("kbd")?.className).toBe("md-tag md-tag-kbd");
    expect(block.querySelector("mark")?.className).toBe("md-tag md-tag-mark");
    view.destroy();
  });
});

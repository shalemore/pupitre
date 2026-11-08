import { describe, expect, it } from "vitest";
import { documentHtml, markdownFragment } from "./document-html";
import { type PageEnvironment, pageStyle } from "./page-style";
import { markdownState } from "./testing";

/** No stylesheet is passed: the page keeps the rules written in the renderer itself. */
const editorCss = "";

const PAGE: PageEnvironment = {
  tokens: {
    page: "#ffffff",
    card: "#ffffff",
    text: "#111111",
    soft: "#333333",
    faint: "#666666",
    accent: "#aa3300",
    danger: "#bb0000",
    note: "#aa3300",
    tip: "#007733",
    important: "#aa3300",
    warning: "#bb0000",
    caution: "#bb0000",
    bodyFont: "system-ui, sans-serif",
    codeFont: "ui-monospace, monospace",
    fontSize: "16px",
    lineHeight: "1.5",
    contentWidth: "42rem",
    syntax: [],
  },
  themeCss: "",
};

describe("exporting footnotes", () => {
  it("gives every reference of a footnote its own way back", async () => {
    const markdown = "Alpha[^1], bravo[^1].\n\n[^1]: The note.\n";
    const html = await markdownFragment(markdownState(markdown), markdown);
    expect(html).toContain('id="fnref-1"');
    expect(html).toContain('id="fnref-1-2"');
    expect(html).toContain('href="#fnref-1"');
    expect(html).toContain('href="#fnref-1-2"');
    expect(html.match(/class="md-footnote-back"/g)).toHaveLength(2);
  });
});

describe("exporting adjacent footnote definitions", () => {
  it("keeps each definition as its own footnote", async () => {
    const markdown = "One[^1] two[^2].\n\n[^1]: First note.\n[^2]: Second note.\n";
    const html = await markdownFragment(markdownState(markdown), markdown);
    expect(html.match(/<li id="fn-/g)).toHaveLength(2);
    expect(html).toContain('<li id="fn-1">First note.');
    expect(html).toContain('<li id="fn-2">Second note.');
  });
});

describe("exporting autolinks", () => {
  it("writes an address as a mail link and keeps a URI's own scheme", async () => {
    const markdown =
      "Write to <user@example.com> or visit <https://example.com>.\n\nBare user@example.com too.\n";
    const html = await markdownFragment(markdownState(markdown), markdown);
    expect(html).toContain('href="mailto:user@example.com"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">user@example.com</a>");
  });

  it("writes a bare www address as a web link", async () => {
    const markdown = "Visit www.example.com today.\n";
    const html = await markdownFragment(markdownState(markdown), markdown);
    expect(html).toContain('href="http://www.example.com"');
  });
});

describe("exporting anchors written as HTML", () => {
  it("keeps the target of an anchor-only paragraph", async () => {
    const markdown = '<a id="quick-start"></a>\n\nJump to [the start](#quick-start).\n';
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain('<a class="md-link" id="quick-start"></a>');
    expect(html).toContain('<a class="md-link" href="#quick-start">the start</a>');
  });

  it("keeps the link an inline HTML anchor stands for", async () => {
    const markdown = 'Visit <a href="https://example.com" title="Example">the site</a> now.\n';
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain(
      '<a class="md-link" href="https://example.com" title="Example" target="_blank" rel="noreferrer">the site</a>',
    );
  });

  it("keeps a target written with the legacy name attribute", async () => {
    const markdown = '<a name="legacy"></a>\n\nJump to [the target](#legacy).\n';
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain('<a class="md-link" id="legacy"></a>');
  });

  it("keeps the target of an anchor that is never closed", async () => {
    const markdown = 'Text <a id="open"> more text\n';
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain('<a class="md-link" id="open"> more text</a>');
  });

  it("keeps a target inside a rendered HTML block", async () => {
    const markdown = '<div><a id="inside">Text</a></div>\n';
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain('id="inside"');
    expect(html).toContain("md-link");
  });
});

describe("exporting comments", () => {
  it("leaves comments out of the page", async () => {
    const markdown = "Alpha <!-- hidden --> beta.\n\n<!-- a block comment -->\n\nGamma.\n";
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).not.toContain("hidden");
    expect(html).not.toContain("block comment");
    expect(html).toContain("Alpha");
    expect(html).toContain("beta.");
    expect(html).toContain("Gamma.");
  });
});

describe("exporting a page", () => {
  const markdown = [
    "# Title",
    "",
    "> A quote.",
    "",
    "---",
    "",
    "- one",
    "- two",
    "",
    "1. first",
    "2. second",
    "",
    "| Head | Other |",
    "| ---- | ----- |",
    "| cell | cell  |",
    "",
    "Text with **strong**, *emphasis*, ~~struck~~, `code`, [a link](https://example.com) and ==mark==.",
    "",
    "```",
    "plain",
    "```",
    "",
  ].join("\n");

  it("marks the markup with the classes the document theme styles", async () => {
    const html = await documentHtml(markdownState(markdown), "Title", editorCss, { page: PAGE });
    expect(html).toContain('<h1 class="md-heading md-h1">');
    expect(html).toContain('<blockquote class="md-quote">');
    expect(html).toContain('<hr class="md-hr">');
    expect(html).toContain('<table class="md-table-view">');
    expect(html).toContain('class="md-list-bullet"');
    expect(html).toContain('<span class="md-list-mark">1. </span>');
    expect(html).toContain('<span class="md-list-mark">2. </span>');
    expect(html).toContain('class="md-strong"');
    expect(html).toContain('class="md-em"');
    expect(html).toContain('class="md-strike"');
    expect(html).toContain('class="md-code"');
    expect(html).toContain('<a class="md-link" href="https://example.com"');
    expect(html).toContain('class="md-tag md-tag-mark"');
    expect(html).toContain('<pre class="md-code-block md-code-block-start md-code-block-end">');
  });
});

describe("copying as a fragment", () => {
  it("keeps the browser's list markers where no stylesheet follows the markup", async () => {
    const markdown = "- one\n- two\n";
    const html = await markdownFragment(markdownState(markdown), markdown);
    expect(html).toContain("<li>one</li>");
    expect(html).not.toContain("md-list-item");
    expect(html).not.toContain("md-list-bullet");
  });
});

describe("the stylesheet of an exported page", () => {
  it("writes the document rules when no stylesheet of the app can be read", () => {
    const css = pageStyle(editorCss, PAGE);
    expect(css).toContain("@layer export-base, editor, document-theme, export-page;");
    expect(css).toContain(".md-list-bullet::before");
    expect(css).toContain("--md-quote-bar");
    expect(css).toContain("@layer export-page");
  });
});

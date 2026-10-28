import { describe, expect, it } from "vitest";
import { markdownState } from "@/features/editor/testing";
import { documentHtml, markdownFragment } from "./document-html";
import { pageStyle } from "./page-style";

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
    const html = await documentHtml(markdownState(markdown), "Title");
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
    const css = pageStyle();
    expect(css).toContain("@layer export-base, editor, document-theme, export-page;");
    expect(css).toContain(".md-list-bullet::before");
    expect(css).toContain("--md-quote-bar");
    expect(css).toContain("@layer export-page");
  });
});

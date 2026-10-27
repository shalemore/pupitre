import { describe, expect, it } from "vitest";
import { markdownState } from "@/features/editor/testing";
import { markdownFragment } from "./document-html";

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

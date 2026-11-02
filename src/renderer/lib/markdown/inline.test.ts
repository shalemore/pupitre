import { describe, expect, it } from "vitest";
import { hasVisibleContent, inlineItems } from "./inline";
import { firstNode, markdownState } from "./testing";

function visible(markdown: string): boolean {
  const state = markdownState(markdown);
  return hasVisibleContent(inlineItems(state, firstNode(state, "Paragraph")));
}

describe("paragraph content", () => {
  it("counts what puts something on the page", () => {
    expect(visible("Text.\n")).toBe(true);
    expect(visible('<a href="https://example.com">a link</a>\n')).toBe(true);
    expect(visible("![a picture](./shot.png)\n")).toBe(true);
    expect(visible("A line<br>break\n")).toBe(true);
  });

  it("does not count an anchor that shows nothing", () => {
    expect(visible('<a id="target"></a>\n')).toBe(false);
    expect(visible('<a name="target"></a>\n')).toBe(false);
    expect(visible('<a id="target"></a> <a href="https://example.com"></a>\n')).toBe(false);
  });
});

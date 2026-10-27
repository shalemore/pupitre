import { describe, expect, it } from "vitest";
import { imageMarkdown, imageOf, imageOrigin, parseImageTag } from "./images";
import { firstNode, markdownState } from "./testing";

describe("image titles", () => {
  it("reads the title of a Markdown image and of an img tag", () => {
    const state = markdownState('![Alt](pic.png "A title")');
    expect(imageOf(state, firstNode(state, "Image"))?.title).toBe("A title");
    expect(parseImageTag('<img src="pic.png" alt="Alt" title="A title" width="300">')?.title).toBe(
      "A title",
    );
  });

  it("reads a single-quoted title, and no title as an empty string", () => {
    const state = markdownState("![Alt](pic.png 'A title')");
    expect(imageOf(state, firstNode(state, "Image"))?.title).toBe("A title");
    const plain = markdownState("![Alt](pic.png)");
    expect(imageOf(plain, firstNode(plain, "Image"))?.title).toBe("");
  });
});

describe("imageOrigin", () => {
  it("reads a file: address as a path on this machine", () => {
    expect(imageOrigin("C:/docs", "file:///C:/pics/a.png")).toEqual({
      kind: "file",
      path: "C:/pics/a.png",
    });
    expect(imageOrigin("C:/docs", "file://server/share/a.png")).toEqual({
      kind: "file",
      path: "//server/share/a.png",
    });
  });

  it("leaves data: and blob: to the page", () => {
    expect(imageOrigin("C:/docs", "data:image/png;base64,abc")).toBeUndefined();
    expect(imageOrigin("C:/docs", "blob:file:///abc")).toBeUndefined();
  });
});

describe("imageMarkdown", () => {
  it("escapes the brackets and backslashes that would end the alt text", () => {
    expect(imageMarkdown("a [b] \\ c", "pic.png")).toBe("![a \\[b\\] \\\\ c](pic.png)");
  });

  it("puts an address with a space between angle brackets", () => {
    expect(imageMarkdown("Alt", "my picture.png")).toBe("![Alt](<my picture.png>)");
  });
});

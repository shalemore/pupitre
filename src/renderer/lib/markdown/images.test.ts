import { describe, expect, it } from "vitest";
import { dataImageFile, imageMarkdown, imageOf, imageOrigin, parseImageTag } from "./images";
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

describe("dataImageFile", () => {
  it("reads a base64 data: image into a file named after its alt text", () => {
    const file = dataImageFile("data:image/png;base64,aGVsbG8=", "Pic");
    expect(file?.name).toBe("Pic.png");
    expect(file?.type).toBe("image/png");
  });

  it("reads a URI-encoded svg and gives an unknown type the plain name", () => {
    const svg = dataImageFile(
      "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E",
      "",
    );
    expect(svg?.name).toBe("image.svg");
    expect(svg?.type).toBe("image/svg+xml");
  });

  it("rejects an address that is not a data: URL", () => {
    expect(dataImageFile("pic.png", "Pic")).toBeUndefined();
  });
});

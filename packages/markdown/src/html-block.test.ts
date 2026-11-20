import { describe, expect, it } from "vitest";
import { htmlBlockPreview, htmlElementContent } from "./html-block";

describe("htmlBlockPreview", () => {
  it("reads a heading with its attribute and content", () => {
    const preview = htmlBlockPreview('<h1 align="right">Title</h1>\n');
    expect(preview?.element.tag).toBe("h1");
    expect(preview?.element.alignment).toBe("right");
    expect(preview?.element.content).toEqual({ from: 18, to: 23 });
    expect(preview?.element.startTag).toEqual({ from: 0, to: 18 });
    expect(preview?.element.endTag).toEqual({ from: 23, to: 28 });
  });

  it("reads a paragraph with an inline link", () => {
    const preview = htmlBlockPreview(
      '<p align="right"><a href="README.md">English</a> | 简体中文</p>\n',
    );
    expect(preview?.element.tag).toBe("p");
    expect(preview?.element.alignment).toBe("right");
    expect(preview?.element.children[0]?.tag).toBe("a");
    expect(preview?.element.children[0]?.href).toBe("README.md");
  });

  it("reads an element whose closing tag is still being typed", () => {
    const incomplete = htmlBlockPreview('<h1 align="right">Pupitre');
    expect(incomplete?.element.alignment).toBe("right");
    expect(incomplete?.element.endTag).toBeUndefined();
    expect(incomplete?.element.content).toEqual({ from: 18, to: 25 });
    // The block's last newline is not part of the content
    expect(htmlBlockPreview("<h1>Title\n")?.element.content).toEqual({ from: 4, to: 9 });
  });

  it("reads an unclosed inline tag to the end of its parent", () => {
    const preview = htmlBlockPreview("<h1>Title <b>bold</h1>");
    expect(preview?.element.children[0]?.tag).toBe("b");
    expect(preview?.element.children[0]?.endTag).toBeUndefined();
    expect(preview?.element.children[0]?.content).toEqual({ from: 13, to: 17 });
  });

  it("reads an attribute written without quotes", () => {
    expect(htmlBlockPreview("<h1 align=right>Title</h1>")?.element.alignment).toBe("right");
  });

  it("ignores an alignment the browser would ignore", () => {
    const preview = htmlBlockPreview('<h1 align="le]dsvsdft">Pupitre</h1>');
    expect(preview?.element.tag).toBe("h1");
    expect(preview?.element.alignment).toBeUndefined();
    expect(htmlBlockPreview("<h1 align>Title</h1>")?.element.tag).toBe("h1");
    expect(htmlBlockPreview('<h1 align="JUSTIFY">Title</h1>')?.element.alignment).toBe("justify");
  });

  it("leaves anything the live preview cannot draw to the rendered block", () => {
    expect(htmlBlockPreview('<p align="left">\n  <img src="a.png" />\n</p>')).toBeUndefined();
    expect(htmlBlockPreview("<div>Text</div>")).toBeUndefined();
    expect(htmlBlockPreview('<h1 class="x">Text</h1>')).toBeUndefined();
    expect(htmlBlockPreview("<h1>Two\nlines</h1>")).toBeUndefined();
    expect(htmlBlockPreview("<h1>Two\nlines")).toBeUndefined();
    expect(htmlBlockPreview("<h1>One</h1><p>Two</p>")).toBeUndefined();
    expect(htmlBlockPreview("<h1>Title</h2>")).toBeUndefined();
    // A tag without its `>` cannot be drawn as the tag it will become
    expect(htmlBlockPreview("<h1")).toBeUndefined();
  });
});

describe("htmlElementContent", () => {
  it("gives the content of an element a selection takes in whole", () => {
    expect(htmlElementContent("<h1>Heading</h1>")).toEqual({ from: 4, to: 11 });
    expect(htmlElementContent('<p align="right">Text</p>')).toEqual({ from: 17, to: 21 });
    expect(htmlElementContent("<h1>Heading")).toEqual({ from: 4, to: 11 });
    expect(htmlElementContent("<h1>Heading\n")).toEqual({ from: 4, to: 11 });
  });

  it("leaves a selection that is not exactly one element alone", () => {
    expect(htmlElementContent("Heading")).toBeUndefined();
    expect(htmlElementContent("<h1>Heading</h1> and more")).toBeUndefined();
    expect(htmlElementContent("<h1>One</h1><p>Two</p>")).toBeUndefined();
  });
});

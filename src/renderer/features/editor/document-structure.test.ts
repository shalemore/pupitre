import { describe, expect, it } from "vitest";
import {
  collectHeadings,
  findActiveHeading,
  findHeadingByAnchor,
  mergeHeadings,
  readableText,
} from "./document-structure";
import { markdownState } from "./testing";

describe("readableText", () => {
  it("leaves out syntax, link destinations, markup and front matter", () => {
    const state = markdownState(
      "---\ntitle: Notes\n---\n\n# A **bold** [link](https://example.com)\n\n<b>Tag</b> \\*escaped\\*",
    );
    expect(readableText(state).replaceAll(/\s+/g, " ").trim()).toBe("A bold link Tag *escaped*");
  });
});

describe("collectHeadings", () => {
  it("lists ATX and setext headings with their level and readable text", () => {
    const state = markdownState("# One\n\nText\n\nTwo *two*\n---\n\n```\n# not a heading\n```");
    expect(collectHeadings(state)).toEqual([
      { level: 1, text: "One", pos: 0 },
      { level: 2, text: "Two two", pos: 13 },
    ]);
  });
});

describe("findHeadingByAnchor", () => {
  const headings = collectHeadings(
    markdownState("# Getting Started!\n\n# 快速开始\n\n# Notes\n\n# Notes"),
  );

  it("matches the anchors GitHub gives headings", () => {
    expect(findHeadingByAnchor(headings, "getting-started")?.text).toBe("Getting Started!");
    expect(findHeadingByAnchor(headings, encodeURIComponent("快速开始"))?.text).toBe("快速开始");
  });

  it("tells repeated headings apart by their number", () => {
    expect(findHeadingByAnchor(headings, "notes")?.pos).toBe(headings[2]?.pos);
    expect(findHeadingByAnchor(headings, "notes-1")?.pos).toBe(headings[3]?.pos);
  });

  it("finds nothing for a malformed or unknown anchor", () => {
    expect(findHeadingByAnchor(headings, "%E0%A4%A")).toBeUndefined();
    expect(findHeadingByAnchor(headings, "missing")).toBeUndefined();
  });
});

describe("findActiveHeading", () => {
  it("is the last heading at or before the cursor", () => {
    const headings = [
      { level: 1, text: "A", pos: 0 },
      { level: 2, text: "B", pos: 10 },
    ];
    expect(findActiveHeading(headings, 5)).toBe(0);
    expect(findActiveHeading(headings, 10)).toBe(1);
    expect(findActiveHeading([], 5)).toBe(-1);
  });
});

describe("mergeHeadings", () => {
  it("keeps the same list and its rows when only positions moved", () => {
    const headings = [{ level: 1, text: "A", pos: 0 }];
    const merged = mergeHeadings(headings, [{ level: 1, text: "A", pos: 20 }]);
    expect(merged).toBe(headings);
    expect(merged[0]?.pos).toBe(20);
  });

  it("builds a new list when a heading is added", () => {
    const headings = [{ level: 1, text: "A", pos: 0 }];
    expect(
      mergeHeadings(headings, [
        { level: 1, text: "A", pos: 0 },
        { level: 2, text: "B", pos: 10 },
      ]),
    ).toEqual([
      { level: 1, text: "A", pos: 0 },
      { level: 2, text: "B", pos: 10 },
    ]);
  });
});

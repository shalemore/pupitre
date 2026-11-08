import { describe, expect, it } from "vitest";
import { inlineItems } from "./inline";
import { firstNode, markdownState } from "./testing";

describe("reference links and pictures", () => {
  it("resolves a full reference to a definition that follows it", () => {
    const doc = "Read [the docs][guide].\n\n[guide]: https://example.com/guide\n";
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      { type: "text", text: "Read " },
      {
        type: "link",
        href: "https://example.com/guide",
        children: [{ type: "text", text: "the docs" }],
      },
      { type: "text", text: "." },
    ]);
  });

  it("resolves the collapsed and shortcut forms", () => {
    const doc = "[a][] and [b].\n\n[a]: https://a.example\n[b]: https://b.example\n";
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      { type: "link", href: "https://a.example", children: [{ type: "text", text: "a" }] },
      { type: "text", text: " and " },
      { type: "link", href: "https://b.example", children: [{ type: "text", text: "b" }] },
      { type: "text", text: "." },
    ]);
  });

  it("matches labels without regard to case or inner whitespace, and keeps the first definition", () => {
    const doc =
      "[x][Some  Label]\n\n[some label]: https://first.example\n[Some Label]: https://second.example\n";
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      { type: "link", href: "https://first.example", children: [{ type: "text", text: "x" }] },
    ]);
  });

  it("draws a reference picture with the destination and title of its definition", () => {
    const doc = '![a picture][shot]\n\n[shot]: <./shot.png> "The shot"\n';
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      {
        type: "image",
        src: "./shot.png",
        alt: "a picture",
        title: "The shot",
        width: undefined,
        alignment: undefined,
        from: 0,
        to: 18,
      },
    ]);
  });

  it("keeps a bracketed run that resolves to nothing as it was written", () => {
    const doc = "See [missing][nowhere] now.\n";
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      { type: "text", text: "See " },
      { type: "text", text: "[" },
      { type: "text", text: "missing" },
      { type: "text", text: "][nowhere]" },
      { type: "text", text: " now." },
    ]);
  });

  it("keeps a picture without a definition as its source", () => {
    const doc = "![missing][nowhere]\n";
    const state = markdownState(doc);
    expect(inlineItems(state, firstNode(state, "Paragraph"))).toEqual([
      { type: "text", text: "![missing][nowhere]" },
    ]);
  });
});

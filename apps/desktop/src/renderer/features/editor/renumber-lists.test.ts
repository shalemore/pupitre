import { describe, expect, it } from "vitest";
import { markdownState, updated } from "@/lib/markdown/testing";
import { orderedListNumbers } from "./renumber-lists";

describe("renumbering ordered lists", () => {
  it("counts the items of a list from one after its first item goes", () => {
    const state = markdownState("1. one\n2. two\n3. three\n");
    const next = updated(state, { changes: { from: 0, to: 7 } });
    expect(orderedListNumbers(next, [{ from: 0, to: 0 }])).toEqual([
      { from: 0, to: 2, insert: "1." },
      { from: 7, to: 9, insert: "2." },
    ]);
  });

  it("renumbers a nested list on its own", () => {
    const state = markdownState("1. a\n   1. x\n   2. y\n2. b\n");
    const next = updated(state, { changes: { from: 5, to: 13 } });
    expect(next.doc.toString()).toBe("1. a\n   2. y\n2. b\n");
    expect(orderedListNumbers(next, [{ from: 5, to: 5 }])).toEqual([
      { from: 8, to: 10, insert: "1." },
    ]);
  });

  it("keeps the delimiter the list was written with", () => {
    const state = markdownState("3) a\n4) b\n");
    expect(orderedListNumbers(state, [{ from: 0, to: 0 }])).toEqual([
      { from: 0, to: 2, insert: "1)" },
      { from: 5, to: 7, insert: "2)" },
    ]);
  });

  it("leaves a list the edit did not touch as it was written", () => {
    const state = markdownState("text\n\n5. a\n6. b\n");
    expect(orderedListNumbers(state, [{ from: 0, to: 0 }])).toEqual([]);
  });
});

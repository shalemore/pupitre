import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { countTextFast, type TextStats } from "@/lib/text-stats";
import { countDocument, countRange, createStatsTracker } from "./document-stats";
import { markdownState } from "./testing";

describe("countRange", () => {
  it("counts the readable text of a range", () => {
    const state = markdownState("A **bold** word");
    expect(countRange(state, 0, state.doc.length)).toEqual({ words: 3, characters: 9 });
  });
});

describe("countDocument", () => {
  it("adds the slices of a large document to the same count as one pass", async () => {
    // Line boundaries keep a word from being split between two slices
    const text = "A line with some words in it.\n\n".repeat(40_000);
    const state = EditorState.create({ doc: text });
    await expect(countDocument(state, () => false)).resolves.toEqual(countTextFast(text));
  });

  it("gives up when a newer edit made the count stale", async () => {
    const text = "A line with words.\n\n".repeat(40_000);
    const state = EditorState.create({ doc: text });
    await expect(countDocument(state, () => true)).resolves.toBeUndefined();
  });
});

describe("createStatsTracker", () => {
  it("recounts only the lines an edit touched", async () => {
    const reports: TextStats[] = [];
    const tracker = createStatsTracker((stats) => reports.push(stats));
    const state = markdownState("One two\n\nThree four");
    tracker.start(state);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reports.at(-1)).toEqual({ words: 4, characters: 15 });

    const update = state.update({ changes: { from: 3, insert: " more" } });
    tracker.changed(update);
    expect(reports.at(-1)).toEqual({ words: 5, characters: 19 });
  });
});

import { describe, expect, it } from "vitest";
import type { Draft } from "./desktop-api";
import { readDraftSession } from "./draft";

const draft: Draft = {
  path: "/notes/today.md",
  markdown: "# Today\n",
  savedMarkdown: "",
  lineEnding: "lf",
  encoding: "utf-8",
  isSample: false,
};

describe("readDraftSession", () => {
  it("reads a session of tabs", () => {
    const session = { tabs: [draft, { ...draft, path: undefined }], active: 1 };
    expect(readDraftSession(session)).toEqual(session);
  });

  it("points the active tab at a tab the session holds", () => {
    expect(readDraftSession({ tabs: [draft], active: 5 })).toEqual({ tabs: [draft], active: 0 });
  });

  it("reads the single draft an older version kept as a session of one tab", () => {
    expect(readDraftSession(draft)).toEqual({ tabs: [draft], active: 0 });
  });

  it("drops what a crash cut short or what is not a draft", () => {
    expect(readDraftSession({ tabs: [], active: 0 })).toBeNull();
    expect(readDraftSession({ tabs: [{ ...draft, markdown: 3 }], active: 0 })).toBeNull();
    expect(readDraftSession({ ...draft, unexpected: true })).toBeNull();
    expect(readDraftSession(null)).toBeNull();
  });
});

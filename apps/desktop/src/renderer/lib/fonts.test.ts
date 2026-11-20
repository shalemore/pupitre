import { describe, expect, it } from "vitest";
import { codeFontFamily, documentFontFamily, interfaceFontFamily } from "./fonts";

describe("documentFontFamily", () => {
  it("leaves the theme alone when nothing is chosen", () => {
    expect(documentFontFamily("", "", "Inter, system-ui, sans-serif", "text")).toBeUndefined();
  });

  it("puts the fallback font before the generic families of a text theme", () => {
    expect(documentFontFamily("", "Source Han Sans", "Inter, system-ui, sans-serif", "text")).toBe(
      'Inter, "Source Han Sans", system-ui, sans-serif',
    );
  });

  it("puts the fallback font after the generic families of a monospace theme", () => {
    expect(documentFontFamily("", "Source Han Sans", '"JetBrains Mono", monospace', "mono")).toBe(
      '"JetBrains Mono", monospace, "Source Han Sans"',
    );
  });

  it("keeps a chosen font in front of the theme's generic families", () => {
    expect(documentFontFamily("Inter", "", "Charter, serif", "text")).toBe('"Inter", serif');
  });
});

describe("codeFontFamily", () => {
  it("places the fallback font the way the document does", () => {
    expect(codeFontFamily("", "Source Han Sans", '"JetBrains Mono", monospace', "text")).toBe(
      '"JetBrains Mono", "Source Han Sans", monospace',
    );
    expect(codeFontFamily("", "Source Han Sans", '"JetBrains Mono", monospace', "mono")).toBe(
      '"JetBrains Mono", monospace, "Source Han Sans"',
    );
  });

  it("keeps the theme's mono faces behind a chosen code font for the scripts they carry", () => {
    expect(
      codeFontFamily(
        "Fira Code",
        "",
        '"JetBrains Mono", "Sarasa Mono SC", system-ui, monospace',
        "text",
      ),
    ).toBe('"Fira Code", "JetBrains Mono", "Sarasa Mono SC", system-ui, monospace');
  });
});

describe("interfaceFontFamily", () => {
  it("leaves the interface on the theme's font when no interface font is chosen", () => {
    expect(interfaceFontFamily("", "")).toBeUndefined();
    expect(interfaceFontFamily("", "Source Han Sans")).toBeUndefined();
  });

  it("puts the chosen interface font first, then the fallback, then the theme's stack", () => {
    expect(interfaceFontFamily("Inter", "")).toBe('"Inter", var(--font-sans)');
    expect(interfaceFontFamily("Inter", "Source Han Sans")).toBe(
      '"Inter", "Source Han Sans", var(--font-sans)',
    );
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";
import { pdfPrintOptions } from "./pdf-print-options";

function optionsFor(patch: Partial<Settings>) {
  return pdfPrintOptions({ ...DEFAULT_SETTINGS, ...patch });
}

describe("pdfPrintOptions", () => {
  it("names the three page sizes the way printToPDF takes them", () => {
    expect(optionsFor({ pdfPageSize: "a4" }).pageSize).toBe("A4");
    expect(optionsFor({ pdfPageSize: "letter" }).pageSize).toBe("Letter");
    expect(optionsFor({ pdfPageSize: "legal" }).pageSize).toBe("Legal");
  });

  it("turns each margin into inches on all four sides", () => {
    expect(optionsFor({ pdfMargin: "none" }).margins).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(optionsFor({ pdfMargin: "narrow" }).margins).toEqual({
      top: 0.5,
      right: 0.5,
      bottom: 0.5,
      left: 0.5,
    });
    expect(optionsFor({ pdfMargin: "normal" }).margins).toEqual({
      top: 0.75,
      right: 0.75,
      bottom: 0.75,
      left: 0.75,
    });
    expect(optionsFor({ pdfMargin: "wide" }).margins).toEqual({
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
    });
  });

  it("keeps room for a page number in the foot even without margins", () => {
    const numbered = optionsFor({ pdfPageNumbers: true, pdfMargin: "none" });
    expect(numbered.displayHeaderFooter).toBe(true);
    expect(numbered.margins).toEqual({ top: 0, right: 0, bottom: 0.5, left: 0 });
    expect(numbered.footerTemplate).toContain('class="pageNumber"');
    expect(numbered.footerTemplate).toContain("padding: 0 0in");

    const wide = optionsFor({ pdfPageNumbers: true, pdfMargin: "wide" });
    expect(wide.margins?.bottom).toBe(1);
  });

  it("keeps the theme's @page in charge and the background printed", () => {
    const options = optionsFor({});
    expect(options.preferCSSPageSize).toBe(true);
    expect(options.printBackground).toBe(true);
    expect(options.displayHeaderFooter).toBe(false);
    expect(options.footerTemplate).toContain("pageNumber");
  });
});

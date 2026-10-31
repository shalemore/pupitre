import type { PrintToPDFOptions } from "electron";
import type { Settings } from "@shared/settings";

/** The sheet of each page size the settings offer, named as printToPDF takes it. */
const PAGE_SIZES: Readonly<Record<Settings["pdfPageSize"], "A4" | "Letter" | "Legal">> = {
  a4: "A4",
  letter: "Letter",
  legal: "Legal",
};

/**
 * The margin of each setting, in inches, around all four edges of the page. `normal` is near the
 * 20 mm at the top and bottom and 18 mm at the sides that every printed page had before the page
 * setup was a setting, so an export made today looks as it did.
 */
const MARGINS: Readonly<Record<Settings["pdfMargin"], number>> = {
  none: 0,
  narrow: 0.5,
  normal: 0.75,
  wide: 1,
};

/** The band at the foot of a page that the page number is drawn in, in inches. */
const FOOTER_ROOM = 0.5;

/**
 * The foot of a page of an exported PDF: the page number, inset by the margin of the page so that
 * it sits over the middle of the text column. Chromium fills in the `pageNumber` and `totalPages`
 * classes.
 */
function pageNumberFooter(margin: number): string {
  return `
  <div style="box-sizing: border-box; width: 100%; padding: 0 ${margin}in; font: 9px/1 sans-serif; color: #8a8a8a; text-align: center;">
    <span class="pageNumber"></span> / <span class="totalPages"></span>
  </div>`;
}

/**
 * The page an exported PDF is laid out on.
 *
 * `preferCSSPageSize` stays on: a theme that sets `@page { size; margin }` for print decides the
 * sheet and its margins for itself, while these values lay out the page for the themes that leave
 * it to the app.
 */
export function pdfPrintOptions(settings: Settings): PrintToPDFOptions {
  const margin = MARGINS[settings.pdfMargin];
  // Chromium draws the foot of a page in the bottom margin, so a numbered page keeps room for its
  // number even when the margins are set to none; a line of footer text fits in half an inch
  const bottom = settings.pdfPageNumbers ? Math.max(margin, FOOTER_ROOM) : margin;
  return {
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: PAGE_SIZES[settings.pdfPageSize],
    margins: { top: margin, right: margin, bottom, left: margin },
    // An empty header keeps the title and the address off the page; the footer carries the number
    displayHeaderFooter: settings.pdfPageNumbers,
    headerTemplate: "<div></div>",
    footerTemplate: pageNumberFooter(margin),
  };
}

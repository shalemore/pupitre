import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserWindow, nativeImage, screen, type NativeImage, type WebContents } from "electron";
import { z } from "zod";

/** Width of the exported document, in CSS pixels, before it is scaled up. */
const DOCUMENT_WIDTH = 900;

/** Device pixels per document pixel: text and vector art stay sharp on a screen of any density. */
const PIXEL_RATIO = 2;

/**
 * Tallest piece that is captured at once, in document pixels. A capture is a grab of the
 * compositor surface, and the largest surface Chromium hands back here holds 16250 device pixels:
 * 7500 document pixels at two device pixels each stay under it, while 16500 come back as an unknown
 * viz error.
 */
const SLICE_HEIGHT = 7500;

/**
 * Room left empty under the page and under every slice, in document pixels. The surface a window
 * paints comes back a row or three taller than the page in it, and those rows are blank, so no
 * slice may reach the bottom of the window.
 */
const SLICE_MARGIN = 16;

/** Tallest document the export accepts: the slices and the image they are stacked into are held in memory at once. */
const MAX_DOCUMENT_HEIGHT = 30000;

/** Rounds of capture that are tried before an export gives up. */
const CAPTURE_ATTEMPTS = 3;

/** How long the export waits before it captures again, multiplied by the round number. */
const CAPTURE_DELAY = 120;

/** Rounds of measuring a page that keeps changing height. */
const HEIGHT_ATTEMPTS = 4;

interface ExportImageOptions {
  /** A complete HTML document, rendered as it is. */
  html: string;
  /** The PNG file to write. */
  filePath: string;
  /**
   * Folder the page is loaded from, so that its relative addresses resolve, and where the page is
   * written as a temporary file. Without it the page goes to the system temporary folder.
   */
  baseFolder: string | undefined;
}

/**
 * Renders a page into one tall PNG: a hidden window lays the document out at its own width, and the
 * part of it a window can hold is captured slice by slice and stacked into a single image. Nothing
 * goes through a canvas, so the image keeps the resolution the compositor rendered.
 */
export async function exportImage({
  html,
  filePath,
  baseFolder,
}: ExportImageOptions): Promise<void> {
  // A page loaded from a data: URL or from the system temporary folder cannot reach the images next
  // to the document, so the page is written next to them when the caller knows the folder; the dot
  // keeps it out of the file listing a sidebar of that folder shows
  const pagePath = join(baseFolder ?? tmpdir(), `.pupitre-export-${randomUUID()}.html`);
  await writeFile(pagePath, withoutScripts(html), "utf8");
  try {
    await writeFile(filePath, await render(pagePath, DOCUMENT_WIDTH));
  } finally {
    await rm(pagePath, { force: true });
  }
}

/**
 * The page's own scripts are removed before it is loaded: the export only measures the page, so
 * nothing in the document has to run, and a page opened next to the user's files has no business
 * running code from them. The tags are what goes: `javascript: false` in the web preferences would
 * also stop the main process from running the script that measures the page.
 *
 * A match can leave another tag behind, so removal repeats until the page stops changing.
 */
function withoutScripts(html: string): string {
  let previous: string;
  do {
    previous = html;
    html = html
      // A browser ends a script at any end tag that starts with `</script`, attributes and all
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, "")
      .replace(/<script\b[^>]*>/gi, "");
  } while (html !== previous);
  return html;
}

/** The hidden window an export renders in, with the sizes it was laid out for. */
interface Surface {
  window: BrowserWindow;
  webContents: WebContents;
  /** Width of the window content, in the device independent pixels a window is sized in. */
  width: number;
  /** The page's zoom: one document pixel covers this many device independent pixels. */
  zoom: number;
  /** Width of the finished image, in device pixels. */
  pixelWidth: number;
  /** Document rows the window shows at once; a slice covers that many, less SLICE_MARGIN. */
  viewport: number;
}

async function render(pagePath: string, documentWidth: number): Promise<Buffer> {
  // A window is rasterized at the scale factor of its display, which the page cannot change, so the
  // page is zoomed the other way: one document pixel then covers exactly PIXEL_RATIO device pixels
  // whatever the display does, and the image comes out the same size everywhere
  const display = screen.getPrimaryDisplay().scaleFactor;
  const zoom = PIXEL_RATIO / display;
  const width = Math.round(documentWidth * zoom);
  const window = new BrowserWindow({
    show: false,
    // Nothing is drawn around the page, so that the content is the whole window
    frame: false,
    width,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      // A window that is not on screen has its renderer paced down, and a page that is paced down
      // paints late: the capture would then still show the frame from before the resize
      backgroundThrottling: false,
    },
  });
  try {
    const { webContents } = window;
    webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    // Windows only show the app's own page, and this one is not even shown: nothing may navigate it
    webContents.on("will-navigate", (event) => event.preventDefault());
    await window.loadFile(pagePath);
    // The zoom belongs to the page that was loaded, so it is set after the load and before the
    // page is measured: the layout the export measures is the one it captures
    webContents.setZoomFactor(zoom);
    // A window draws a scrollbar down the side of a page taller than itself: it would end up in the
    // image and take a few pixels off the width the document is laid out in
    await runInPage(
      webContents,
      `(() => {
        const style = document.createElement("style");
        style.textContent = "html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }";
        document.documentElement.append(style);
      })()`,
    );

    const surface: Surface = {
      window,
      webContents,
      width,
      zoom,
      pixelWidth: documentWidth * PIXEL_RATIO,
      viewport: SLICE_HEIGHT,
    };
    // A page that does not scroll is as tall as its window, so it is first measured in a window one
    // row tall: the page is taller than that whatever it holds
    sizeWindow(surface, 1);
    const height = Math.round(
      await settleHeight(surface, await measure(webContents), HEIGHT_ATTEMPTS),
    );
    if (height > MAX_DOCUMENT_HEIGHT) {
      throw new Error(
        `The document is ${height} CSS pixels tall, more than the ${MAX_DOCUMENT_HEIGHT} CSS pixels an exported image holds`,
      );
    }

    // The room under the page is what lets the last slice be cut before the blank rows of the
    // window; the window is sized once here and keeps that size for every slice after it, because a
    // window that is resized between two captures paints the next one from the top of a stale frame
    await runInPage(
      webContents,
      `document.documentElement.style.paddingBottom = "${SLICE_MARGIN}px"`,
    );
    sizeWindow(surface, Math.min(height + SLICE_MARGIN, SLICE_HEIGHT));

    const slices = await captureBelow(surface, 0, height, []);
    const stacked = stack(slices);
    const image =
      stacked.width === surface.pixelWidth
        ? stacked.image
        : stacked.image.resize({ width: surface.pixelWidth });
    return image.toPNG();
  } finally {
    window.destroy();
  }
}

/** Sizes the window to a number of document rows, remembering what it shows now. */
function sizeWindow(surface: Surface, rows: number): void {
  surface.viewport = rows;
  surface.window.setContentSize(surface.width, Math.max(1, Math.round(rows * surface.zoom)));
}

/**
 * The document's height in CSS pixels, measured until a resize stops changing it: a font, an image
 * or a viewport-relative rule can reflow the page after its load event.
 */
async function settleHeight(surface: Surface, height: number, rounds: number): Promise<number> {
  if (rounds === 0) return height;
  // A document too tall for one capture is measured at the height it is captured at, because the
  // window cannot be given the height of the whole document
  sizeWindow(surface, Math.min(height, SLICE_HEIGHT));
  const resized = await measure(surface.webContents);
  return resized === height ? height : settleHeight(surface, resized, rounds - 1);
}

/** The page's height once its fonts are in and two frames have been drawn: nothing measured then is laid out half-way. */
async function measure(webContents: WebContents): Promise<number> {
  const height = await runInPage(
    webContents,
    `(async () => {
      await document.fonts.ready;
      await new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn)));
      const html = document.documentElement;
      // A page taller than its window reports its own height; a shorter one is reported as tall as
      // the window, so it is measured at the bottom of what it holds instead
      if (html.scrollHeight > html.clientHeight + 1) return html.scrollHeight;
      const body = document.body;
      if (!body) return html.scrollHeight;
      return Math.max(1, Math.ceil(body.getBoundingClientRect().bottom + window.scrollY));
    })()`,
  );
  return Math.round(numberFromPage(height, "a page height"));
}

/** Scrolls the page to a place in the document and reports where the window ended up. */
function scrollTo(top: number): string {
  return `(async () => {
    const html = document.documentElement;
    // A page cannot scroll past its end, and the last slice needs the rows it covers in the window
    // even when its own first row cannot reach the top, so the page clamps to whole rows itself
    window.scrollTo(0, Math.max(0, Math.min(${top}, Math.floor(html.scrollHeight - html.clientHeight))));
    await new Promise((drawn) => requestAnimationFrame(() => requestAnimationFrame(drawn)));
    return { top: html.scrollTop, visible: html.clientHeight };
  })()`;
}

const scrollPositionSchema = z.object({
  top: z.number(),
  visible: z.number(),
});

/** Where the page sits after a scroll: what it reports is checked before it is used. */
function placement(value: unknown): { top: number; visible: number } {
  const parsed = scrollPositionSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`The exported page reported ${String(value)} instead of its scroll position`);
  }
  return parsed.data;
}

/** Runs a script in the page: the result is what the document gave back, so it is checked before use. */
function runInPage(webContents: WebContents, script: string): Promise<unknown> {
  return webContents.executeJavaScript(script, true);
}

function numberFromPage(value: unknown, what: string): number {
  const parsed = z.number().safeParse(value);
  if (!parsed.success) {
    throw new Error(`The exported page reported ${String(value)} instead of ${what}`);
  }
  return parsed.data;
}

/** Captures the page from `top` down, one slice per round: a round captures the place the round before it scrolled to. */
async function captureBelow(
  surface: Surface,
  top: number,
  height: number,
  slices: readonly NativeImage[],
): Promise<readonly NativeImage[]> {
  if (top >= height) return slices;
  const rows = Math.min(surface.viewport - SLICE_MARGIN, height - top);
  // The page scrolls under the window, and the last slice cannot scroll its own top to the top of
  // the window: it scrolls as far as the page allows, and the rows it covers are cut out of the
  // window where the page really put them
  const placed = placement(await runInPage(surface.webContents, scrollTo(top)));
  if (placed.top + placed.visible < Math.min(top + rows, height)) {
    throw new Error(
      `The page showed the rows from ${placed.top} only, so the image would miss a part of the document`,
    );
  }
  const slice = await captureSlice(
    surface.webContents,
    surface.pixelWidth,
    rows * PIXEL_RATIO,
    Math.round((top - placed.top) * PIXEL_RATIO),
  );
  return captureBelow(surface, top + rows, height, [...slices, slice]);
}

/**
 * One piece of the page, cut to the rows it was meant to cover: a hidden window hands back the frame
 * it has, which can be a pixel or two taller than the window, and the last slice begins a few rows
 * into that frame. A capture taken before the window painted comes back empty, which is worth
 * another round.
 */
async function captureSlice(
  webContents: WebContents,
  width: number,
  height: number,
  from: number,
  round = 1,
): Promise<NativeImage> {
  // A window that is not on screen paints when it is told to
  webContents.invalidate();
  let failure: unknown;
  try {
    const image = await webContents.capturePage();
    if (!image.isEmpty()) return cutToRows(image, width, height, from);
    failure = new Error("the capture is empty");
  } catch (error) {
    failure = error;
  }
  if (round === CAPTURE_ATTEMPTS) {
    const reason = failure instanceof Error ? failure.message : String(failure);
    throw new Error(`Could not capture the page after ${CAPTURE_ATTEMPTS} rounds: ${reason}`);
  }
  await new Promise((waited) => setTimeout(waited, CAPTURE_DELAY * round));
  return captureSlice(webContents, width, height, from, round + 1);
}

function cutToRows(image: NativeImage, width: number, height: number, from: number): NativeImage {
  const size = image.getSize();
  if (size.height < from + height) {
    throw new Error(
      `The page was captured at ${size.width}×${size.height} pixels, too small for the ${height} rows from ${from} it was asked for`,
    );
  }
  return image.crop({ x: 0, y: from, width: Math.min(size.width, width), height });
}

/**
 * Stacks the slices into one image: they share their width, so their bitmaps are rows of equal
 * length and one bitmap after the other is the finished picture.
 */
function stack(slices: readonly NativeImage[]): { image: NativeImage; width: number } {
  const buffers: Buffer[] = [];
  let width = 0;
  let height = 0;
  for (const slice of slices) {
    const size = slice.getSize();
    if (width === 0) width = size.width;
    if (size.width !== width) {
      throw new Error(`A slice is ${size.width} pixels wide instead of the ${width} of the first`);
    }
    const bitmap = slice.toBitmap();
    if (bitmap.length !== size.width * size.height * 4) {
      throw new Error(
        `A slice of ${size.width}×${size.height} pixels came back with ${bitmap.length} bytes`,
      );
    }
    buffers.push(bitmap);
    height += size.height;
  }
  const image = nativeImage.createFromBitmap(Buffer.concat(buffers), {
    width,
    height,
    scaleFactor: PIXEL_RATIO,
  });
  return { image, width };
}

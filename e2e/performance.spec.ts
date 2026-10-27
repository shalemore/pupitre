import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { close, launch, run } from "./app";
import type { TestApp } from "./app";

/**
 * What the app costs, measured on the built one: a cold start, opening documents of 200 KB, 5 MB
 * and 20 MB up to their last line, the latency of typing, and the memory the main process holds.
 * Absolute numbers belong to the machine that measured them; the assertions only catch a run that
 * broke, so treat the report as the result and not this file passing.
 */

const TAIL_MARKER = "END-OF-PERF-DOCUMENT";

/** A generated document of this many characters, all ASCII, so a char is a byte. */
const SECTION = `## A section of the performance fixture

Pupitre keeps the document on disk as the Markdown it shows, so every marker is a real character and the file is saved exactly as it was edited. A paragraph this long is the common case in a long note, and the editor decorates only the part of it that the viewport shows.

- A list item that holds a sentence of its own, long enough to wrap in a narrow window
- Another item, so the parser has a list to close before the paragraph after it

A line with *emphasis*, **strong text**, a [link](https://example.com), a \`code span\` and an ==highlight== reads as text until the cursor touches it.
`;

/**
 * `article` is the long note typing is measured on: a document of a few hundred kilobytes reads as
 * a long article, and the keystroke cost there is the one a user meets all day. The larger
 * documents are about opening them, scrolling to the end and counting them. A JavaScript string
 * tops out below 512 MiB, so 500 MB is the practical ceiling for a document held whole.
 */
const FILE_SIZE = {
  article: 200 * 1024,
  small: 5 * 1024 * 1024,
  large: 100 * 1024 * 1024,
  huge: 200 * 1024 * 1024,
  maximum: 500 * 1024 * 1024,
};

/** Limits that only catch a broken run, not a slow machine. */
const OPEN_LIMIT_MS = 180_000;
const TYPING_P95_LIMIT_MS = 250;

interface Measurement {
  name: string;
  value: number;
  unit: string;
}

const measurements: Measurement[] = [];

function record(name: string, value: number, unit: string): void {
  measurements.push({ name, value: Math.round(value * 10) / 10, unit });
}

function documentOf(bytes: number, title: string): string {
  const head = `# Performance fixture: ${title}\n\n`;
  let text = head;
  while (text.length < bytes) text += SECTION;
  return `${text}\n${TAIL_MARKER}\n`;
}

interface GeneratedDocument {
  folder: string;
  file: string;
}

/** A folder for the generated files, kept out of the profile so a relaunch still finds them. */
async function generateDocument(title: string, bytes: number): Promise<GeneratedDocument> {
  const folder = await mkdtemp(join(tmpdir(), "pupitre-perf-"));
  const file = join(folder, `${title}.md`);
  await writeFile(file, documentOf(bytes, title));
  return { folder, file };
}

/** Resident memory of the main process: the renderer holds the tree, this side holds the file. */
async function mainRssMib(app: ElectronApplication): Promise<number> {
  const rss = await app.evaluate(() => process.memoryUsage().rss);
  return rss / (1024 * 1024);
}

/**
 * The time from the launch to the last line on screen: the window paints, the main process reads
 * the file, the renderer replaces the document, and a jump to the end makes it draw the tail.
 */
async function openToTail(testApp: TestApp, title: string, started: number): Promise<number> {
  const { page } = testApp;
  await expect(page.locator(".cm-content")).toContainText(`Performance fixture: ${title}`, {
    timeout: OPEN_LIMIT_MS,
  });
  // The editor draws only the lines in the viewport, so the last line has to be scrolled to
  await page.locator(".cm-line").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await expect(page.locator(".cm-content")).toContainText(TAIL_MARKER, { timeout: OPEN_LIMIT_MS });
  return performance.now() - started;
}

/** The time until the title bar shows a count for the document, from the launch. */
async function counted(page: Page, started: number): Promise<number> {
  await page.waitForFunction(
    () => {
      const count = document.querySelector('[data-bar-part="count"]')?.textContent ?? "";
      return count.trim() !== "" && !/^\s*0\b/.test(count);
    },
    undefined,
    { timeout: OPEN_LIMIT_MS },
  );
  return performance.now() - started;
}

/**
 * Times a keystroke from its `keydown` to the first frame drawn after it, which is where the
 * character becomes visible. The listener sits on the document in the capture phase, so it starts
 * before CodeMirror handles the key rather than after it. The measure runs from the event's own
 * timestamp to the frame's, both on the same clock, so the keystrokes of a run do not share one
 * mark.
 */
async function measureTyping(page: Page, text: string): Promise<number[]> {
  await page.locator(".cm-line").first().click();
  await page.evaluate(() => {
    // A measure left by an earlier typing in this window would be read as one of these keystrokes
    performance.clearMeasures("typing-latency");
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key.length !== 1) return;
        requestAnimationFrame((frameTime) => {
          performance.measure("typing-latency", { start: event.timeStamp, end: frameTime });
        });
      },
      true,
    );
  });
  await page.keyboard.type(text);
  await expect(page.locator(".cm-content")).toContainText(text);
  return page.evaluate(() =>
    performance
      .getEntriesByType("measure")
      .filter((entry) => entry.name === "typing-latency")
      .map((entry) => entry.duration),
  );
}

/** The latency of typing into the find field, where every character used to count the whole file. */
async function measureFindTyping(page: Page, text: string): Promise<number[]> {
  await run(page, { id: "edit.find" });
  const input = page.locator('[data-slot="find-bar"] input').first();
  await input.waitFor({ timeout: OPEN_LIMIT_MS });
  await input.click();
  await page.evaluate(() => {
    performance.clearMeasures("find-latency");
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key.length !== 1) return;
        requestAnimationFrame((frameTime) => {
          performance.measure("find-latency", { start: event.timeStamp, end: frameTime });
        });
      },
      true,
    );
  });
  await page.keyboard.type(text);
  return page.evaluate(() =>
    performance
      .getEntriesByType("measure")
      .filter((entry) => entry.name === "find-latency")
      .map((entry) => entry.duration),
  );
}

/**
 * The latency that this share of the keystrokes stayed under. It throws rather than answers 0 when
 * nothing was timed, so a run that measured no keystroke cannot pass as a fast one.
 */
function percentile(values: readonly number[], fraction: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  const value = sorted[index];
  if (value === undefined) throw new Error(`no measurement to take the ${fraction} percentile of`);
  return value;
}

test("measures the cold start to the editor", async () => {
  const started = performance.now();
  const testApp = await launch();
  try {
    // A window without a document shows what to do next rather than an editor
    await run(testApp.page, { id: "file.new" });
    await testApp.page.locator(".cm-content").waitFor({ timeout: OPEN_LIMIT_MS });
    const coldStart = performance.now() - started;
    record("cold start to .cm-content", coldStart, "ms");
    record("main process RSS after start", await mainRssMib(testApp.app), "MiB");
    expect(coldStart).toBeLessThan(OPEN_LIMIT_MS);
  } finally {
    await close(testApp);
  }
});

test("opens a 200 KB document and types into it", async () => {
  const generated = await generateDocument("200 KB", FILE_SIZE.article);
  const started = performance.now();
  const testApp = await launch({ files: [generated.file] });
  try {
    const open = await openToTail(testApp, "200 KB", started);
    record("open 200 KB to the tail", open, "ms");
    record("main process RSS after 200 KB", await mainRssMib(testApp.app), "MiB");
    expect(open).toBeLessThan(OPEN_LIMIT_MS);

    // Twenty characters, a short phrase, typed one keystroke at a time
    const latencies = await measureTyping(testApp.page, "typing latency check");
    expect(latencies.length).toBeGreaterThan(0);
    const p95 = percentile(latencies, 0.95);
    record("typing latency median", percentile(latencies, 0.5), "ms");
    record("typing latency p95", p95, "ms");
    record("keystrokes measured", latencies.length, "keystrokes");
    expect(p95).toBeLessThan(TYPING_P95_LIMIT_MS);
  } finally {
    await close(testApp);
    await rm(generated.folder, { recursive: true, force: true });
  }
});

test("opens a 5 MB document, counts it and types into it", async () => {
  const generated = await generateDocument("5 MB", FILE_SIZE.small);
  const started = performance.now();
  const testApp = await launch({ files: [generated.file] });
  try {
    const open = await openToTail(testApp, "5 MB", started);
    record("open 5 MB to the tail", open, "ms");
    record("counts 5 MB", await counted(testApp.page, started), "ms");
    record("main process RSS after 5 MB", await mainRssMib(testApp.app), "MiB");
    expect(open).toBeLessThan(OPEN_LIMIT_MS);

    const latencies = await measureTyping(testApp.page, "typing a large document");
    expect(latencies.length).toBeGreaterThan(0);
    const p95 = percentile(latencies, 0.95);
    record("typing 5 MB median", percentile(latencies, 0.5), "ms");
    record("typing 5 MB p95", p95, "ms");
    expect(p95).toBeLessThan(TYPING_P95_LIMIT_MS);
  } finally {
    await close(testApp);
    await rm(generated.folder, { recursive: true, force: true });
  }
});

test("opens a 100 MB document", async () => {
  const generated = await generateDocument("100 MB", FILE_SIZE.large);
  const started = performance.now();
  const testApp = await launch({ files: [generated.file] });
  try {
    const open = await openToTail(testApp, "100 MB", started);
    record("open 100 MB to the tail", open, "ms");
    record("counts 100 MB", await counted(testApp.page, started), "ms");
    record("main process RSS after 100 MB", await mainRssMib(testApp.app), "MiB");
    expect(open).toBeLessThan(OPEN_LIMIT_MS);

    const findLatencies = await measureFindTyping(testApp.page, "Pupitre");
    expect(findLatencies.length).toBeGreaterThan(0);
    record("find typing 100 MB median", percentile(findLatencies, 0.5), "ms");
    record("find typing 100 MB p95", percentile(findLatencies, 0.95), "ms");
    const findStarted = performance.now();
    await testApp.page.keyboard.press("Enter");
    record("find next 100 MB", performance.now() - findStarted, "ms");
  } finally {
    await close(testApp);
    await rm(generated.folder, { recursive: true, force: true });
  }
});

test("opens a 200 MB document", async () => {
  const generated = await generateDocument("200 MB", FILE_SIZE.huge);
  const started = performance.now();
  const testApp = await launch({ files: [generated.file] });
  try {
    const open = await openToTail(testApp, "200 MB", started);
    record("open 200 MB to the tail", open, "ms");
    record("counts 200 MB", await counted(testApp.page, started), "ms");
    record("main process RSS after 200 MB", await mainRssMib(testApp.app), "MiB");
    expect(open).toBeLessThan(OPEN_LIMIT_MS);
  } finally {
    await close(testApp);
    await rm(generated.folder, { recursive: true, force: true });
  }
});

test("opens a 500 MB document", async () => {
  const generated = await generateDocument("500 MB", FILE_SIZE.maximum);
  const started = performance.now();
  const testApp = await launch({ files: [generated.file] });
  try {
    const open = await openToTail(testApp, "500 MB", started);
    record("open 500 MB to the tail", open, "ms");
    record("counts 500 MB", await counted(testApp.page, started), "ms");
    record("main process RSS after 500 MB", await mainRssMib(testApp.app), "MiB");
    expect(open).toBeLessThan(OPEN_LIMIT_MS);
  } finally {
    await close(testApp);
    await rm(generated.folder, { recursive: true, force: true });
  }
});

test.afterAll(() => {
  const report = Object.fromEntries(
    measurements.map(({ name, value, unit }) => [name, `${value} ${unit}`]),
  );
  const date = new Date().toISOString().slice(0, 10);
  console.log(`\nPerformance, measured ${date} on ${process.platform}/${process.arch}:`);
  console.log("Absolute numbers belong to this machine and are not comparable across machines.");
  console.log(JSON.stringify(report, null, 2));
});

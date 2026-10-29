import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import type { AppCommand } from "../src/shared/desktop-api";

/** Playwright starts in the repository root, where `npm run build` left `out/`. */
const ROOT = process.cwd();
const MAIN = join(ROOT, "out/main/index.js");

export interface TestApp {
  readonly app: ElectronApplication;
  readonly page: Page;
  /** The profile Chromium, the settings and the drafts live in, so a relaunch can pick them up. */
  readonly profile: string;
  readonly temp: string;
}

export interface LaunchOptions {
  readonly files?: readonly string[];
  /** Reuse the profile of a launch that was killed, to bring its draft back. */
  readonly profile?: string;
  /** Settings written into a fresh profile before the app starts, such as `{ tabs: true }`. */
  readonly settings?: Readonly<Record<string, unknown>>;
}

/**
 * Starts the built app on a profile of its own. A second launch would otherwise hand its file to the
 * first one through the single-instance lock. A window Chromium believes is covered also stops its
 * timers, which the draft test relies on.
 */
export async function launch(options: LaunchOptions = {}): Promise<TestApp> {
  if (!existsSync(MAIN)) throw new Error(`${MAIN} is missing; run \`npm run build\` first`);
  const temp = await mkdtemp(join(tmpdir(), "pupitre-e2e-"));
  const profile = options.profile ?? join(temp, "profile");
  if (options.settings !== undefined) {
    await mkdir(profile, { recursive: true });
    await writeFile(join(profile, "settings.json"), JSON.stringify(options.settings), "utf8");
  }
  const app = await electron.launch({
    cwd: ROOT,
    args: [
      MAIN,
      `--user-data-dir=${profile}`,
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-background-timer-throttling",
      ...(process.platform === "linux" ? ["--no-sandbox"] : []),
      ...(options.files ?? []),
    ],
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return { app, page, profile, temp };
}

/** Closes the app if it still runs, then removes everything the launch created. */
export async function close(testApp: TestApp): Promise<void> {
  // A recovered draft leaves the tab dirty, so a plain quit would wait on a native box forever.
  await testApp.app
    .evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    })
    .catch(() => {
      // A test that kills the app leaves nothing to close.
    });
  await testApp.app.close().catch(() => {
    // A test that kills the app leaves nothing to close.
  });
  await rm(testApp.temp, { recursive: true, force: true });
}

/**
 * Ends the app the way a crash would: no window close, no draft flush, no questions. The whole
 * process tree goes, because Electron's helpers keep the profile busy after their parent is gone.
 */
export async function kill(app: ElectronApplication): Promise<void> {
  const { pid } = app.process();
  if (pid === undefined) return;
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    process.kill(pid, "SIGKILL");
  }
  if (app.process().exitCode === null) {
    await new Promise<void>((resolve) => app.process().once("exit", resolve));
  }
}

/** Sends the command a menu entry or a shortcut would, since native menus do not answer CDP keys. */
export async function run(page: Page, command: AppCommand): Promise<void> {
  await page.evaluate((next) => window.desktop.invoke("app:dispatch", next), command);
}

/** Replaces the whole document, the way selecting everything and typing over it does. */
export async function replaceText(page: Page, text: string): Promise<void> {
  await page.locator(".cm-content").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(text);
}

export async function editorText(page: Page): Promise<string> {
  return page.locator(".cm-content").innerText();
}

/**
 * Answers the native message boxes the next steps open, by button index, in the order they open.
 */
export async function answerDialogs(
  app: ElectronApplication,
  answers: readonly number[],
): Promise<void> {
  await app.evaluate(({ dialog }, answersToGive) => {
    const pending = [...answersToGive];
    dialog.showMessageBox = async () => ({
      response: pending.shift() ?? 0,
      checkboxChecked: false,
    });
  }, answers);
}

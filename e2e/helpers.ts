import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type FileChooser, type Locator, type Page } from "@playwright/test";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

export const PHOTO_FILE = {
  name: "photo.jpg",
  mimeType: "image/jpeg",
  path: path.join(fixturesDir, "photo.jpg"),
} as const;

export async function jpegInput(name: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  return {
    name,
    mimeType: "image/jpeg",
    buffer: await readFile(PHOTO_FILE.path),
  };
}

const SHORT_CUTS = {
  duration: 0.5,
  fps: 30,
  slots: [0, 0.2, 0.4],
  slotPhotoOrder: [0, 1, 0],
  photoCount: 2,
} as const;

/** WebKit on Linux often lacks H.264; Chromium bundled by Playwright often does too. VP8 WebM is the portable fixture. */
export async function stubShortTemplate(page: Page): Promise<void> {
  const webm = await readFile(path.join(fixturesDir, "clip.webm"));
  const serveClip = () => ({
    body: webm,
    contentType: "video/webm",
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

  await page.route("**/official-assets/template/landscape-cuts.json", (route) => route.fulfill({ json: SHORT_CUTS }));
  await page.route("**/official-assets/template/landscape.mp4", (route) => route.fulfill(serveClip()));
}

export async function blockAnalytics(page: Page): Promise<void> {
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.route("https://www.google-analytics.com/**", (route) => route.abort());
  await page.route("https://*.ingest.us.sentry.io/**", (route) => route.abort());
  await page.route("https://platform.twitter.com/**", (route) => route.abort());
}

export function stripZwsp(text: string): string {
  return text.replaceAll("\u200b", "");
}

/** Visible copy, ignoring BudouX zero-width phrase breaks. */
export async function expectVisibleText(locator: Locator, expected: string): Promise<void> {
  await expect.poll(async () => stripZwsp((await locator.textContent()) ?? "")).toBe(expected);
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator("#toCommunity").waitFor({ state: "attached" });
  await page.locator("#toStudio").waitFor({ state: "attached" });
  await page.locator("#app[data-app-ready='1']").waitFor({ state: "attached" });
}

/**
 * Listen for a file dialog, then run `action`.
 *
 * `waitForEvent("filechooser")` returns while Chromium's interception CDP call
 * is still in flight. Enter or a click started in that same turn can open the
 * dialog before interception is active, and headless Chromium then never
 * reports it. That shows up on a cold browser while the studio is still
 * starting, and the retry passes. The round trip below is ordered after the
 * interception call.
 */
export async function fileChooserFor(page: Page, action: () => Promise<unknown>): Promise<FileChooser> {
  const chooser = page.waitForEvent("filechooser");
  await page.evaluate(() => true);
  await action();
  return chooser;
}

export async function openStudio(page: Page): Promise<void> {
  const studio = page.locator("#studioView");
  if (await studio.isVisible()) return;
  await page.locator("#toStudio").click();
  await studio.waitFor({ state: "visible" });
}

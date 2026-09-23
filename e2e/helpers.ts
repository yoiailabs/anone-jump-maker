import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

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

  await page.route("**/template/cuts.json", (route) => route.fulfill({ json: SHORT_CUTS }));
  await page.route("**/template/landscape-cuts.json", (route) => route.fulfill({ json: SHORT_CUTS }));
  await page.route("**/template/vertical.mp4", (route) => route.fulfill(serveClip()));
  await page.route("**/template/landscape.mp4", (route) => route.fulfill(serveClip()));
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

export async function waitForAppReady(page: Page): Promise<void> {
  await page.locator("#toCommunity").waitFor({ state: "attached" });
  await page.locator("#toStudio").waitFor({ state: "attached" });
  await page.locator("#app[data-app-ready='1']").waitFor({ state: "attached" });
}

export async function chooseStudioOption(
  page: Page,
  name: "aspect" | "swap" | "filter" | "character",
  value: string,
): Promise<void> {
  const label = page.locator(`#${name}Popover label:has(input[name="${name}"][value="${value}"])`);
  const trigger = page.locator(`#${name}PopoverTrigger`);
  await expect(async () => {
    if (!(await label.isVisible())) await trigger.click();
    await label.click({ timeout: 1_500 });
  }).toPass({ timeout: 8_000 });
}

export async function openStudio(page: Page): Promise<void> {
  const studio = page.locator("#studioView");
  if (await studio.isVisible()) return;
  await page.locator("#toStudio").click();
  await studio.waitFor({ state: "visible" });
}

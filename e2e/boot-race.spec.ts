import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { blockAnalytics, goToWizardStep, PHOTO_FILE, waitForAppReady } from "./helpers.ts";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const SHORT_CUTS = {
  duration: 0.5,
  fps: 30,
  slots: [0, 0.2, 0.4],
  slotPhotoOrder: [0, 1, 0],
  photoCount: 2,
} as const;

test("binds the picker before cuts.json returns and retains the selection across steps", async ({ page }) => {
  await blockAnalytics(page);

  let releaseCuts!: () => void;
  const cutsHeld = new Promise<void>((resolve) => {
    releaseCuts = resolve;
  });
  const webm = await readFile(path.join(fixturesDir, "clip.webm"));
  const serveClip = () => ({
    body: webm,
    contentType: "video/webm",
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });

  await page.route("**/template/cuts.json", async (route) => {
    await cutsHeld;
    await route.fulfill({ json: SHORT_CUTS });
  });
  await page.route("**/template/landscape-cuts.json", async (route) => {
    await cutsHeld;
    await route.fulfill({ json: SHORT_CUTS });
  });
  await page.route("**/template/vertical.mp4", (route) => route.fulfill(serveClip()));
  await page.route("**/template/landscape.mp4", (route) => route.fulfill(serveClip()));

  await page.goto("/make");
  await page.locator('#app[data-controls-ready="1"]').waitFor({ state: "attached" });
  await expect(page.locator("#app[data-app-ready='1']")).toHaveCount(0);

  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);

  releaseCuts();
  await waitForAppReady(page);
  await expect(page.locator("#thumbs img")).toHaveCount(1, { timeout: 20_000 });
  await goToWizardStep(page, 2);
  await page.locator('label:has(input[name="aspect"][value="portrait"])').click();
  await expect(page.getByRole("radio", { name: "縦" }).first()).toBeChecked();
  await expect(page.locator("#playBtn")).toBeEnabled();
  await expect(page.locator("#thumbs img")).toHaveCount(1);
});

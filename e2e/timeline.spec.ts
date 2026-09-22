import { expect, test } from "@playwright/test";
import {
  blockAnalytics,
  stubShortTemplate,
  jpegInput,
  waitForAppReady,
} from "./helpers";
test("seeks without playing and keeps a long photo timeline inside the viewport", async ({
  page,
}) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
  await expect(page.locator("#playhead")).toBeDisabled();
  await page
    .locator("#picker")
    .setInputFiles(
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => jpegInput(`photo-${i}.jpg`)),
      ),
    );
  await expect(page.locator("#playhead")).toBeEnabled();
  await expect(page.locator("#playhead")).toHaveAttribute("max", "0.5");
  await page.locator("#playhead").press("ArrowRight");
  await expect
    .poll(() =>
      page
        .locator("video.offscreen-video")
        .evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
  const dimensions = await page
    .locator("#thumbs")
    .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".thumb").first().press("ArrowRight");
  await expect(page.locator("#thumbs img").first()).toHaveAttribute(
    "alt",
    "photo-1.jpg",
  );
  await expect(page.locator("#saveBtn")).toBeEnabled();
});

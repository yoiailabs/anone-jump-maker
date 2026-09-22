import { expect, test } from "@playwright/test";
import {
  blockAnalytics,
  stubShortTemplate,
  jpegInput,
  waitForAppReady,
  goToWizardStep,
} from "./helpers";
test("four steps gate progress, preserve edits on back, and stop hidden playback", async ({
  page,
}) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
  await expect(page.locator("#wizardNext")).toBeDisabled();
  await expect(page.locator("#saveBtn")).toBeHidden();
  await page
    .locator("#picker")
    .setInputFiles([
      await jpegInput("first.jpg"),
      await jpegInput("second.jpg"),
    ]);
  await goToWizardStep(page, 1);
  await page.locator(".thumb").first().press("ArrowRight");
  await expect(page.locator("#thumbs img").first()).toHaveAttribute(
    "alt",
    "second.jpg",
  );
  await goToWizardStep(page, 2);
  await page.locator("#playBtn").click();
  await goToWizardStep(page, 3);
  await expect(page.locator("#stage")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#saveBtn")).toBeVisible();
  await expect(page.locator("#wizardNext")).toBeHidden();
  await goToWizardStep(page, 1);
  await expect(page.locator("#thumbs img").first()).toHaveAttribute(
    "alt",
    "second.jpg",
  );
  await expect(page.locator(".step-dots [aria-current='step']")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

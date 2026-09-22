import { expect, test } from "@playwright/test";
import {
  blockAnalytics,
  goToWizardStep,
  PHOTO_FILE,
  stubShortTemplate,
  waitForAppReady,
} from "./helpers";
test("inline preview, aspect and customization use the existing compositor", async ({
  page,
}) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
  await page.goto("/make");
  await waitForAppReady(page);
  await expect(page.locator("#playBtn")).toBeDisabled();
  await page.locator("#picker").setInputFiles(PHOTO_FILE.path);
  await expect(page.locator("#playBtn")).toBeEnabled();
  await goToWizardStep(page, 2);
  await expect(page.locator("#stage canvas")).toBeVisible();
  await page.locator("#playBtn").click();
  await expect(page.locator("#previewRegion")).toBeVisible();
  await page
    .locator('label:has(input[name="aspect"][value="portrait"])')
    .click();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-aspect",
    "portrait",
  );
  await page.locator(".editor-settings summary").click();
  await page.locator('label:has(input[name="swap"][value="zoom"])').click();
  await page
    .locator('label:has(input[name="filter"][value="blur-weak"])')
    .click();
  await page.locator('label:has(input[name="character"][value="1.2"])').click();
  await expect(
    page.locator('input[name="character"][value="1.2"]'),
  ).toBeChecked();
  await page.locator(".editor-settings summary").click();
  await page.locator("#muteBtn").click();
  await expect(page.locator("#muteBtn")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("#restartBtn").click();
  await expect(page.locator("#status")).not.toHaveAttribute(
    "data-kind",
    "error",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

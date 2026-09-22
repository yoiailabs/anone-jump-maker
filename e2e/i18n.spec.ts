import { expect, test } from "@playwright/test";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers";
import { t } from "../src/i18n";
import { siteCopy } from "../src/site-copy";
import { MORE_JUMPS_HREF } from "../src/social";
test.beforeEach(async ({ page }) => {
  await blockAnalytics(page);
  await stubShortTemplate(page);
});
for (const locale of ["ja", "en", "ko", "zh"] as const) {
  const prefix = locale === "ja" ? "" : `/${locale}`;
  test(`home and maker work in ${locale}`, async ({ page }) => {
    await page.goto(prefix || "/");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(t(locale, "makerTitle"));
    const start = page.locator("#startMaking");
    await expect(start).toHaveText(siteCopy[locale].start);
    await expect(start).toBeInViewport();
    await expect(start).toHaveAttribute("href", `${prefix}/make`);
    await expect(page.locator(".quiet-link")).toHaveAttribute(
      "href",
      MORE_JUMPS_HREF,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://anone.yoiailabs.com${prefix || "/"}`,
    );
    expect(
      await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => /\/template\//.test(entry.name)),
      ),
    ).toBe(false);
    await start.click();
    await waitForAppReady(page);
    await expect(page).toHaveURL(new RegExp(`${prefix}/make/?$`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://anone.yoiailabs.com${prefix}/make`,
    );
    await expect(page.locator('.lang-switch a[lang="ko"]')).toHaveAttribute(
      "href",
      "/ko/make",
    );
    await expect(page.locator("#saveBtn")).toBeDisabled();
    await expect(page.locator("iframe, #communityView")).toHaveCount(0);
  });
  test(`retired community ${locale} returns home`, async ({ page }) => {
    await page.goto(`${prefix}/community`);
    await expect(page).toHaveURL(new RegExp(`${prefix || ""}/?$`));
    await expect(page.locator("#startMaking")).toBeVisible();
  });
}
test("language choice persists while keeping /make", async ({ page }) => {
  await page.goto("/make");
  await waitForAppReady(page);
  await page.locator('.lang-switch a[lang="en"]').click();
  await expect(page).toHaveURL(/\/en\/make\/?$/);
  await waitForAppReady(page);
  await page.goto("/make");
  await expect(page).toHaveURL(/\/en\/make\/?$/);
});
test("sitemap indexes home and make, with no gallery", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).not.toContain("community");
  expect(xml).toContain("/en/make");
  expect(xml.match(/<loc>/g)).toHaveLength(10);
});
test.describe("browser locale", () => {
  test.use({ locale: "en-US" });
  test("routes a first visit to English", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("#startMaking")).toHaveText("Make a video");
  });
});

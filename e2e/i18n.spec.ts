import { expect, test } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("language routing", () => {
  test.use({ locale: "en-US" });

  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("routes the English browser from / to /en and shows English copy", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/en\/?$/);
    await waitForAppReady(page);
    await expect(page).toHaveTitle(t("en", "makerTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#makerTitle")).toHaveText(t("en", "makerTitle"));
    await expect(page.locator("#playBtn")).toHaveText(t("en", "makerPreview"));
    await expect(page.locator("#linksTitle")).toHaveText(t("en", "makerOfficial"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("en", "makerPvAria", { song: t("en", "songTitle") }),
    );
    await expect(page.locator("#toCommunity")).toHaveAttribute("href", "/en/community");
    await expect(page.locator(".lang-switch").first()).toBeVisible();
    await expect(page.locator('.lang-switch a[lang="en"]').first()).toHaveAttribute("aria-current", "page");
  });
});

test.describe("language switcher", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("switches from the header and footer menus and keeps the community path", async ({ page }) => {
    const headerEn = page.locator("#makerView .hero .lang-switch a[lang='en']");
    const footerEn = page.locator("#makerView .notes .lang-switch a[lang='en']");
    await expect(headerEn).toBeVisible();
    await expect(footerEn).toBeVisible();
    await expect(headerEn).toHaveAttribute("href", "/en");
    await expect(footerEn).toHaveAttribute("href", "/en");

    await headerEn.click();
    await page.waitForURL(/\/en\/?$/);
    await waitForAppReady(page);
    await expect(page.locator("#makerTitle")).toHaveText(t("en", "makerTitle"));

    await page.locator("#toCommunity").click();
    await expect(page).toHaveURL(/\/en\/community\/?$/);
    await expect(page.locator("#communityJumpsTitle")).toHaveText(t("en", "communityTitle"));
    await expect(page.locator("#communityView .hero .lang-switch a[lang='ko']")).toHaveAttribute(
      "href",
      "/ko/community",
    );

    await page.locator("#communityView .hero .lang-switch a[lang='ja']").click();
    await page.waitForURL(/\/community\/?$/);
    await waitForAppReady(page);
    await expect(page.locator("#communityJumpsTitle")).toHaveText(t("ja", "communityTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  });
});

test.describe("song and artist names", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("keeps Japanese titles on / and English store titles on /ko and /zh", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await expect(page.locator("#linksTitle")).toHaveText(t("ja", "makerOfficial"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("ja", "makerPvAria", { song: t("ja", "songTitle") }),
    );

    await page.goto("/ko");
    await waitForAppReady(page);
    await expect(page.locator("#linksTitle")).toHaveText(t("ko", "makerOfficial"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("ko", "makerPvAria", { song: t("ko", "songTitle") }),
    );

    await page.goto("/zh");
    await waitForAppReady(page);
    await expect(page.locator("#linksTitle")).toHaveText(t("zh", "makerOfficial"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("zh", "makerPvAria", { song: t("zh", "songTitle") }),
    );
  });
});

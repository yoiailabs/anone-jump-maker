import { expect, test } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { PRIVACY_CONTACT_URL } from "../src/privacy.ts";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("privacy policy", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("links from the maker and community footer and opens /privacy", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const footer = page.locator("#siteFooter");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText("Yoiailabs");
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");
    await expect(page.locator("#privacyPolicyLink")).toHaveText(t("ja", "privacyLink"));
    await expect(page.locator("#linksTitle")).toHaveText(t("ja", "makerOfficial"));
    await expect(page.locator("#makerView .notes .lang-switch a[lang='en']")).toHaveAttribute("href", "/en");

    await page.locator("#toCommunity").click();
    await expect(page).toHaveURL(/\/community\/?$/);
    await expect(page.locator("#privacyPolicyLink")).toBeVisible();
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");
    await expect(page.locator("#makerView #linksTitle")).toHaveText(t("ja", "makerOfficial"));
    await expect(page.locator("#makerView")).toBeHidden();
    await expect(page.locator("#communityView .lang-switch a[lang='en']").first()).toHaveAttribute(
      "href",
      "/en/community",
    );

    await page.locator("#privacyPolicyLink").click();
    await expect(page).toHaveURL(/\/privacy\/?$/);
    await expect(page).toHaveTitle(t("ja", "privacyTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#privacyTitle")).toHaveText(t("ja", "privacyTitle"));
    await expect(page.locator("#privacyPolicy")).toContainText("Yoiailabs");
    await expect(page.locator("#privacyPolicy")).toContainText("アップロードすることはありません");
    await expect(page.locator("#privacyPolicy")).toContainText("プレビュー");
    await expect(page.locator('a[href="https://policies.google.com/privacy"]')).toBeVisible();
    await expect(page.locator(`a[href="${PRIVACY_CONTACT_URL}"]`)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/privacy",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      t("ja", "metaPrivacyDescription"),
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/en/privacy",
    );
    await expect(page.locator("#playBtn")).toHaveCount(0);
    await expect(page.locator("#privacyBack")).toHaveAttribute("href", "/");
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("aria-current", "page");
  });

  test("serves the English policy at /en/privacy", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page).toHaveTitle(t("en", "privacyTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#privacyTitle")).toHaveText(t("en", "privacyTitle"));
    await expect(page.locator("#privacyPolicy")).toContainText("not uploaded");
    await expect(page.locator("#siteFooter")).toContainText("Yoiailabs");
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/en/privacy");
    await expect(page.locator('.lang-switch a[lang="ko"]')).toHaveAttribute("href", "/ko/privacy");
  });
});

test.describe("privacy language redirect", () => {
  test.use({ locale: "en-US" });

  test("sends an English browser from /privacy to /en/privacy", async ({ page }) => {
    await blockAnalytics(page);
    await page.goto("/privacy");
    await page.waitForURL(/\/en\/privacy\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#privacyTitle")).toHaveText(t("en", "privacyTitle"));
  });
});

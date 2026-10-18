import { expect, test } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { GOOGLE_PRIVACY_POLICY_URL } from "../src/privacy.ts";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("privacy policy", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("links from the maker footer and opens /privacy", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const footer = page.locator("#siteFooter");
    await expect(footer).toBeVisible();
    await expect(page.locator(".site-footer-credit")).toHaveText("© 2026 Yoiailabs");
    await expect(footer).not.toContainText("運営:");
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");
    await expect(page.locator("#privacyPolicyLink")).toHaveText(t("ja", "privacyLink"));
    await expect(page.locator("#linksTitle")).toHaveText(t("ja", "makerOfficial"));
    await expect(page.locator("#makerView .notes .lang-switch a[lang='en']")).toHaveAttribute("href", "/en");
    await expect(page.locator("#makerView")).toBeVisible();

    await page.locator("#privacyPolicyLink").click();
    await expect(page).toHaveURL(/\/privacy\/?$/);
    await expect(page).toHaveTitle(t("ja", "privacyTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#privacyTitle")).toHaveText(t("ja", "privacyTitle"));
    await expect(page.locator(".hero .eyebrow")).toHaveCount(0);
    await expect(page.locator("#privacyPolicy")).toContainText("Yoiailabs");
    await expect(page.locator("#privacyPolicy")).toContainText("第1条");
    await expect(page.locator("#privacyPolicy")).toContainText("アップロードすることはありません");
    await expect(page.locator("#privacyPolicy")).toContainText("第10条　本ポリシーの変更");
    await expect(page.locator("#privacyPolicy")).not.toContainText("【要記入】");
    await expect(page.locator('a[href="' + GOOGLE_PRIVACY_POLICY_URL + '"]')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/privacy",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      t("ja", "metaPrivacyDescription"),
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/privacy",
    );
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(0);
    await expect(page.locator(".lang-switch")).toHaveCount(0);
    await expect(page.locator("#playBtn")).toHaveCount(0);
    await expect(page.locator("#legalHome")).toHaveAttribute("href", "/");
    await expect(page.locator("#legalHome")).toHaveAttribute("aria-label", "トップへ戻る");
    await expect(page.locator("#legalHome img")).toHaveAttribute("src", "/brand/anone-logo-horizontal.svg");
    await expect(page.locator("#legalHome img")).toHaveAttribute("alt", "あのねジャンプメーカー");
    await expect(page.locator("#legalHome .hero-logo")).toHaveCount(0);
    await expect(page.locator("#privacyBack")).toHaveAttribute("href", "/");
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("aria-current", "page");
  });

  test("shows the Japanese policy from the English maker and from /en/privacy", async ({ page }) => {
    await page.goto("/en");
    await waitForAppReady(page);
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");
    await expect(page.locator("#termsLink")).toHaveAttribute("href", "/terms");
    await expect(page.locator('.lang-switch a[lang="ko"]').first()).toHaveAttribute("href", "/ko");

    await page.goto("/en/privacy");
    await expect(page).toHaveURL(/\/privacy\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#privacyTitle")).toHaveText(t("ja", "privacyTitle"));
    await expect(page.locator("#privacyPolicy")).toContainText("アップロードすることはありません");
    await expect(page.locator("#privacyPolicy")).not.toContainText("not uploaded");
    await expect(page.locator(".lang-switch")).toHaveCount(0);
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");
  });
});

test.describe("privacy logo", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("returns to the maker from the logo", async ({ page }) => {
    await page.goto("/privacy");
    await page.locator("#legalHome").click();
    await expect(page).toHaveURL(/\/$/);
    await waitForAppReady(page);
    await expect(page.locator("#makerTitle img")).toHaveAttribute("src", "/brand/anone-logo-stacked.svg");
  });
});

test.describe("privacy stays in Japanese", () => {
  test.use({ locale: "en-US" });

  test("keeps an English browser on the Japanese policy", async ({ page }) => {
    await blockAnalytics(page);
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#privacyTitle")).toHaveText(t("ja", "privacyTitle"));
    await expect(page.locator("#privacyPolicy")).toContainText("第1条");
  });
});

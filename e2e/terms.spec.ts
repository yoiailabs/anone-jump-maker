import { expect, test } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { blockAnalytics, stubShortTemplate, waitForAppReady } from "./helpers.ts";

test.describe("terms of use", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("links from the footer and opens /terms", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const footer = page.locator("#siteFooter");
    await expect(footer).toContainText("非公式");
    await expect(footer).toContainText("Yoiailabs");
    await expect(page.locator("#termsLink")).toHaveAttribute("href", "/terms");
    await expect(page.locator("#termsLink")).toHaveText(t("ja", "termsLink"));
    await expect(page.locator("#privacyPolicyLink")).toHaveAttribute("href", "/privacy");

    await page.locator("#termsLink").click();
    await expect(page).toHaveURL(/\/terms\/?$/);
    await expect(page).toHaveTitle(t("ja", "termsTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#termsTitle")).toHaveText(t("ja", "termsTitle"));
    await expect(page.locator(".hero .eyebrow")).toHaveCount(0);
    const article = page.locator("#termsOfUse");
    await expect(article).toContainText("2026年9月22日");
    await expect(article).toContainText("Yoiailabs（個人制作者）");
    await expect(article).toContainText("第1条　本サービスの位置付け");
    await expect(article).toContainText("第13条　お問い合わせ");
    await expect(article).toContainText("非公式サービス");
    await expect(article).toContainText("営利目的に使用する行為");
    await expect(article).toContainText("確認に必要な場合は追加の情報をお願いすることがあります。");
    await expect(article).not.toContainText("GitHub Issues");
    await expect(article).not.toContainText("【要記入】");
    await expect(article).not.toContainText("編集者向け");
    await expect(article.locator('a[href="/privacy"]')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/terms",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      t("ja", "metaTermsDescription"),
    );
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0);
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/terms",
    );
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(0);
    await expect(page.locator(".lang-switch")).toHaveCount(0);
    await expect(page.locator("#playBtn")).toHaveCount(0);
    await expect(page.locator("#legalHome")).toHaveAttribute("href", "/");
    await expect(page.locator("#legalHome img")).toHaveAttribute("src", "/official-assets/brand/anone-logo-horizontal.svg");
    await expect(page.locator("#legalHome img")).toHaveAttribute("alt", "あのねジャンプメーカー");
    await expect(page.locator("#legalHome .hero-logo")).toHaveCount(0);
    await expect(page.locator("#termsBack")).toHaveAttribute("href", "/");
    await expect(page.locator("#termsLink")).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#privacyPolicyLink")).not.toHaveAttribute("aria-current", "page");
  });

  test("shows the Japanese terms from /en/terms", async ({ page }) => {
    await page.goto("/en/terms");
    await expect(page).toHaveURL(/\/terms\/?$/);
    await expect(page).toHaveTitle(t("ja", "termsTitle"));
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#termsTitle")).toHaveText(t("ja", "termsTitle"));
    await expect(page.locator("#termsOfUse")).toContainText("非公式サービス");
    await expect(page.locator("#termsOfUse")).toContainText("営利目的に使用する行為");
    await expect(page.locator("#termsOfUse")).not.toContainText("unofficial service");
    await expect(page.locator("#termsOfUse a[href='/privacy']")).toBeVisible();
    await expect(page.locator("#termsLink")).toHaveAttribute("href", "/terms");
    await expect(page.locator(".lang-switch")).toHaveCount(0);
    await expect(page.locator("#termsOfUse")).not.toContainText("GitHub Issues");
  });
});

test.describe("terms logo", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("returns to the maker from the logo", async ({ page }) => {
    await page.goto("/terms");
    await page.locator("#legalHome").click();
    await expect(page).toHaveURL(/\/$/);
    await waitForAppReady(page);
    await expect(page.locator("#makerTitle img")).toHaveAttribute("src", "/official-assets/brand/anone-logo-stacked.svg");
  });
});

test.describe("terms stay in Japanese", () => {
  test.use({ locale: "en-US" });

  test("keeps an English browser on the Japanese terms", async ({ page }) => {
    await blockAnalytics(page);
    await page.goto("/terms");
    await expect(page).toHaveURL(/\/terms\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator("#termsTitle")).toHaveText(t("ja", "termsTitle"));
    await expect(page.locator("#termsOfUse")).toContainText("第1条");
  });
});

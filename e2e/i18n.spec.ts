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
    await expect(page.locator("#makerTitle .hero-logo")).toBeVisible();
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("src", "/brand/anone-logo-stacked-en.svg");
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("alt", t("en", "makerTitle"));
    await expect(page.locator("#makerView .eyebrow")).toHaveCount(0);
    await expect(page.locator("#toStudio")).toHaveText(t("en", "makerMakeVideo"));
    await expect(page.locator("#toStudio")).toHaveAttribute("href", "/en/make");
    await expect(page.locator("#makerView #picker")).toHaveCount(0);
    await page.locator("#toStudio").click();
    await expect(page).toHaveURL(/\/en\/make\/?$/);
    await expect(page).toHaveTitle(t("en", "studioTitle"));
    await expect(page.locator("#studioEmpty")).toHaveText(t("en", "studioEmpty"));
    await expect(page.locator("#saveBtn")).toHaveText(t("en", "makerSave"));
    await expect(page.locator("#previewSaveHint")).toHaveText(t("en", "previewSaveHint"));
    await expect(page.locator("#muteBtn .preview-mute-hint")).toHaveText(t("en", "previewMuteHint"));
    await expect(page.locator("#browsersNote")).toHaveCount(0);
    await expect(page.locator("#onDeviceNote")).toHaveText(t("en", "makerOnDevice"));
    await page.locator("#toLanding").click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("#browsersNote")).toHaveCount(0);
    await expect(page.locator("#linksTitle")).toHaveText(t("en", "makerOfficial"));
    await expect(page.locator("#officialMvTitle")).toHaveText(t("en", "makerOfficialMv"));
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
    await expect(page.locator("#makerTitle .hero-logo")).toBeVisible();
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("src", "/brand/anone-logo-stacked-en.svg");
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("alt", t("en", "makerTitle"));

    await page.locator("#toCommunity").click();
    await expect(page).toHaveURL(/\/en\/community\/?$/);
    await expect(page.locator("#communityJumpsTitle")).toHaveText(t("en", "communityTitle"));
    await expect(page.locator("#communityView .eyebrow")).toHaveCount(0);
    await expect(page.locator("#communityJumpsTitle a")).toHaveCount(0);
    await expect(page.locator('#communityHashtagSearch a[data-service="x"]')).toHaveAttribute(
      "aria-label",
      t("en", "communityHashtagSearchAria", { label: "X" }),
    );
    await expect(page.locator("#communityHashtagSearchHeading")).toHaveText(
      t("en", "communityHashtagSearchLede"),
    );
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

test.describe("localized OGP and SEO", () => {
  test("emits Japanese Open Graph, Twitter, and hreflang on /", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "ja_JP");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", t("ja", "makerTitle"));
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", t("ja", "makerTitle"));
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      t("ja", "metaMakerDescription"),
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://anone.yoiailabs.com/og.png",
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/",
    );
    const jsonLd = await page.locator('script[type="application/ld+json"]').evaluate((el) => el.textContent ?? "");
    expect(jsonLd).toContain('"inLanguage":"ja"');
    expect(jsonLd).toContain(t("ja", "makerTitle"));
  });

  test("emits English Open Graph, Twitter, and hreflang on /en", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", t("en", "makerTitle"));
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", t("en", "makerTitle"));
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      t("en", "metaMakerDescription"),
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://anone.yoiailabs.com/og-en.png",
    );
    await expect(page.locator('link[rel="alternate"][hreflang="ja"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/",
    );
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      "href",
      "https://anone.yoiailabs.com/",
    );
    const jsonLd = await page.locator('script[type="application/ld+json"]').evaluate((el) => el.textContent ?? "");
    expect(jsonLd).toContain('"inLanguage":"en"');
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", t("en", "makerTitle"));
    const fontHref = await page.locator('link[href*="fonts.googleapis.com/css2"]').first().getAttribute("href");
    expect(fontHref).toContain("Zen+Maru+Gothic");
    expect(fontHref).toContain("wght@400;700");
    expect(fontHref).not.toContain("500");
    expect(fontHref).not.toContain("Noto+Sans+KR");
    expect(fontHref).not.toContain("Noto+Sans+SC");
  });

  test("exposes a hreflang sitemap and robots.txt", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    const xml = await sitemap.text();
    expect(xml).toContain("https://anone.yoiailabs.com/en");
    expect(xml).toContain('hreflang="ko"');
    expect(xml).toContain('hreflang="x-default"');
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("https://anone.yoiailabs.com/sitemap.xml");
    const ogEn = await request.get("/og-en.png");
    expect(ogEn.ok()).toBe(true);
    expect(ogEn.headers()["content-type"]).toMatch(/image\/png/);
  });
});

test.describe("crawlers keep the default Japanese URL", () => {
  test.use({
    locale: "en-US",
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });

  test("does not bounce / to /en", async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
    await page.goto("/");
    await waitForAppReady(page);
    await expect(page).not.toHaveURL(/\/en(\/|$)/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page).toHaveTitle(t("ja", "makerTitle"));
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "ja_JP");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", t("ja", "makerTitle"));
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      "content",
      t("ja", "metaMakerDescription"),
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", t("ja", "makerTitle"));
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      "content",
      t("ja", "metaMakerDescription"),
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://anone.yoiailabs.com/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://anone.yoiailabs.com/og.png",
    );
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
    await expect(page.locator("#officialMvTitle")).toHaveText(t("ja", "makerOfficialMv"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("ja", "makerPvAria", { song: t("ja", "songTitle") }),
    );

    await page.goto("/ko");
    await waitForAppReady(page);
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("src", "/brand/anone-logo-stacked-en.svg");
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("alt", t("ko", "makerTitle"));
    await expect(page.locator("#makerView .eyebrow")).toHaveCount(0);
    await expect(page.locator("#linksTitle")).toHaveText(t("ko", "makerOfficial"));
    await expect(page.locator("#officialMvTitle")).toHaveText(t("ko", "makerOfficialMv"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("ko", "makerPvAria", { song: t("ko", "songTitle") }),
    );
    await expect(page.locator('link[href*="fonts.googleapis.com/css2"]').first()).toHaveAttribute(
      "href",
      /Noto\+Sans\+KR/,
    );

    await page.goto("/zh");
    await waitForAppReady(page);
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("src", "/brand/anone-logo-stacked-en.svg");
    await expect(page.locator("#makerTitle .hero-logo")).toHaveAttribute("alt", t("zh", "makerTitle"));
    await expect(page.locator("#makerView .eyebrow")).toHaveCount(0);
    await expect(page.locator("#linksTitle")).toHaveText(t("zh", "makerOfficial"));
    await expect(page.locator("#officialMvTitle")).toHaveText(t("zh", "makerOfficialMv"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("zh", "makerPvAria", { song: t("zh", "songTitle") }),
    );
  });
});

test.describe("maker intro copy", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("hides the old intro lines and keeps the short on-device note", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await expect(page.locator("#makerView .lede")).toHaveCount(0);
    await expect(page.locator("#makerView #onDeviceNote")).toHaveCount(0);
    await expect(page.locator("#toStudio")).toHaveText(t("ja", "makerMakeVideo"));
    await page.locator("#toStudio").click();
    await expect(page).toHaveURL(/\/make\/?$/);
    await expect(page.locator("#studioEmpty")).toHaveText(t("ja", "studioEmpty"));
    await expect(page.locator("#onDeviceNote")).toHaveText(t("ja", "makerOnDevice"));
    const text = (await page.locator("#makerView").innerText()).replaceAll("\u200b", "");
    expect(text).not.toContain("写真を何枚か選択するだけで");
    expect(text).not.toContain("動画生成はすべて端末内で完結するため");
    expect(text).not.toContain("※ファン制作の非公式アプリです。");

    await page.goto("/en");
    await waitForAppReady(page);
    await expect(page.locator("#onDeviceNote")).toHaveText(t("en", "makerOnDevice"));
    const en = (await page.locator("#makerView").innerText()).replaceAll("\u200b", "");
    expect(en).not.toContain("Pick a few photos to make an Anone Jump video");
    expect(en).not.toContain("Unofficial fan-made app.");
  });
});

test.describe("community lede phrase wrapping", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("wraps Japanese community lede at phrase boundaries and leaves English unchanged", async ({ page }) => {
    await page.goto("/community");
    await waitForAppReady(page);
    const jaExpected = t("ja", "communityLede");
    await expect
      .poll(async () =>
        page.locator("#communityJumps .lede").evaluate((el) => {
          const text = el.textContent ?? "";
          const wordBreak = getComputedStyle(el).wordBreak;
          return {
            visible: text.replaceAll("\u200b", ""),
            hasBreaks: text.includes("\u200b") || wordBreak === "auto-phrase",
          };
        }),
      )
      .toEqual({ visible: jaExpected, hasBreaks: true });

    await page.goto("/en/community");
    await waitForAppReady(page);
    const enExpected = t("en", "communityLede");
    const en = await page.locator("#communityJumps .lede").evaluate((el) => ({
      text: el.textContent ?? "",
      wordBreak: getComputedStyle(el).wordBreak,
    }));
    expect(en.text).toBe(enExpected);
    expect(en.text).not.toContain("\u200b");
    expect(en.wordBreak).not.toBe("auto-phrase");
  });
});

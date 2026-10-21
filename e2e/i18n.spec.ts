import { expect, test, type Locator } from "@playwright/test";
import { t } from "../src/i18n.ts";
import { SOURCE_REPO_HREF } from "../src/links.ts";
import { MORE_JUMPS_HREF } from "../src/share.ts";
import { blockAnalytics, expectVisibleText, stubShortTemplate, waitForAppReady } from "./helpers.ts";

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
    await expect(page.locator("#studioEmpty")).toHaveText("");
    await expect(page.locator("#saveBtn")).toHaveText(t("en", "makerSave"));
    await expect(page.locator("#previewSaveHint")).toHaveText(t("en", "previewSaveHint"));
    await expect(page.locator("#muteBtn .preview-mute-hint")).toHaveText(t("en", "previewMuteHint"));
    await expect(page.locator("#browsersNote")).toHaveCount(0);
    await expect(page.locator("#onDeviceNote")).toHaveText(t("en", "makerOnDevice"));
    await expect(page.locator("#studioHome img")).toHaveAttribute("src", "/brand/anone-logo-stacked-en.svg");
    await expect(page.locator("#studioHome img")).toHaveClass(/hero-logo/);
    await expect(page.locator("#toLanding")).toHaveCount(0);
    await expect(page.locator("#studioView .studio-top .lang-switch")).toHaveCount(0);
    await expect(page.locator("#studioView .lang-switch")).toHaveCount(1);
    await page.locator("#studioHome").click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("#browsersNote")).toHaveCount(0);
    await expect(page.locator("#linksTitle")).toHaveText(t("en", "makerOfficial"));
    await expect(page.locator("#officialMvTitle")).toHaveText(t("en", "makerOfficialMv"));
    await expect(page.locator(".loop-link")).toHaveAttribute(
      "aria-label",
      t("en", "makerPvAria", { song: t("en", "songTitle") }),
    );
    await expect(page.locator("#toCommunity")).toHaveAttribute("href", MORE_JUMPS_HREF);
    await expect(page.locator("#toCommunity")).toHaveAttribute("target", "_blank");
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

  test("switches from the header and footer menus", async ({ page }) => {
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
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#toCommunity")).toHaveAttribute("href", MORE_JUMPS_HREF);
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
    const assets = [
      ["/og.png", /image\/png/],
      ["/og-en.png", /image\/png/],
      ["/og-ko.png", /image\/png/],
      ["/og-zh.png", /image\/png/],
      ["/brand/anone-logo-stacked.svg", /image\/svg\+xml/],
      ["/brand/anone-logo-horizontal.svg", /image\/svg\+xml/],
      ["/official-assets/jump-loop-still.png", /image\/png/],
      ["/official-assets/jump-loop.mp4", /video\//],
      ["/official-assets/template/landscape-cuts.json", /json/],
      ["/official-assets/template/landscape.mp4", /video\//],
      ["/favicon.svg", /image\/svg\+xml/],
      ["/icons/icon-192.png", /image\/png/],
    ] as const;
    for (const [asset, type] of assets) {
      const response = await request.get(asset);
      expect(response.ok(), asset).toBe(true);
      expect(response.headers()["content-type"] ?? "", asset).toMatch(type);
    }
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
    await expect(page.locator("#studioEmpty")).toHaveText("");
    await expectVisibleText(page.locator("#onDeviceNote"), t("ja", "makerOnDevice"));
    const text = (await page.locator("#makerView").innerText()).replaceAll("\u200b", "");
    expect(text).not.toContain("写真を何枚か選択するだけで");
    expect(text).not.toContain("動画生成はすべて端末内で完結するため");
    expect(text).not.toContain("※ファン制作の非公式アプリです。");
    expect(text).not.toContain("※ファン制作の非公式サイトです");
    await expect(page.locator("#fanNote")).toHaveCount(0);

    await page.goto("/en");
    await waitForAppReady(page);
    await expect(page.locator("#onDeviceNote")).toHaveText(t("en", "makerOnDevice"));
    const en = (await page.locator("#makerView").innerText()).replaceAll("\u200b", "");
    expect(en).not.toContain("Pick a few photos to make an Anone Jump video");
    expect(en).not.toContain("Unofficial fan-made app.");
    expect(en).not.toContain("unofficial fan-made site");
    await expect(page.locator("#fanNote")).toHaveCount(0);
  });
});

test.describe("on-device note phrase wrapping", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("wraps the Japanese on-device note at phrase boundaries and leaves English unchanged", async ({ page }) => {
    await page.goto("/make");
    await waitForAppReady(page);
    const jaExpected = t("ja", "makerOnDevice");
    await expect
      .poll(async () =>
        page.locator("#onDeviceNote").evaluate((el) => {
          const text = el.textContent ?? "";
          const wordBreak = getComputedStyle(el).wordBreak;
          return {
            visible: text.replaceAll("\u200b", ""),
            hasBreaks: text.includes("\u200b") || wordBreak === "auto-phrase",
          };
        }),
      )
      .toEqual({ visible: jaExpected, hasBreaks: true });

    await page.goto("/en/make");
    await waitForAppReady(page);
    const en = await page.locator("#onDeviceNote").evaluate((el) => ({
      text: el.textContent ?? "",
      wordBreak: getComputedStyle(el).wordBreak,
    }));
    expect(en.text).toBe(t("en", "makerOnDevice"));
    await expect(page.locator("#pickHint")).toHaveText(t("en", "makerPhotoCountHint"));
    expect(en.text).not.toContain("\u200b");
    expect(en.wordBreak).not.toBe("auto-phrase");
  });
});

test.describe("source repository link", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("shows the header mark on top pages and the footer link on top and make", async ({ page }) => {
    for (const [path, locale] of [
      ["/", "ja"],
      ["/en", "en"],
      ["/ko", "ko"],
      ["/zh", "zh"],
    ] as const) {
      await page.goto(path);
      await waitForAppReady(page);
      await expect(page.locator("#makerView")).toBeVisible();
      await expectRepoLink(page.locator("#footerGitHub"), t(locale, "makerSource"));
      await expectRepoLink(page.locator("#makerHeaderGitHub"), "GitHub");
      await expect(page.locator("#makerHeaderGitHub")).toHaveAttribute("aria-label", "GitHub");
      await expect(page.locator("#studioHeaderGitHub")).toHaveCount(0);
      // Read peers in one layout snapshot: font loading and scroll anchoring
      // can move the page between separate boundingBox round trips.
      const [footerBox, privacyBox] = await page.evaluate(() =>
        ["#footerGitHub", "#privacyPolicyLink"].map((selector) => {
          const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      expect(footerBox && privacyBox && Math.abs(footerBox.y - privacyBox.y) < 8).toBe(true);
      const iconBox = await page.locator("#makerHeaderGitHub").boundingBox();
      const links = page.locator("#makerView .hero .lang-switch a");
      const linkCount = await links.count();
      for (let index = 0; index < linkCount; index += 1) {
        const linkBox = await links.nth(index).boundingBox();
        expect(iconBox && linkBox && !boxesOverlap(iconBox, linkBox)).toBe(true);
      }
      const logoBox = await page.locator("#makerTitle .hero-logo").boundingBox();
      expect(iconBox && logoBox && !boxesOverlap(iconBox, logoBox)).toBe(true);
    }

    await page.goto("/make");
    await waitForAppReady(page);
    await expect(page.locator("#studioView")).toBeVisible();
    await expect(page.locator("#makerView")).toBeHidden();
    await expectRepoLink(page.locator("#footerGitHub"), t("ja", "makerSource"));
    await expect(page.locator(".header-github")).toHaveCount(1);
    await expect(page.locator("#makerHeaderGitHub")).toBeHidden();
    await expect(page.locator("#studioHeaderGitHub")).toHaveCount(0);
  });
});

async function expectRepoLink(link: Locator, accessibleName: string) {
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", SOURCE_REPO_HREF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const hidden = await link.evaluate((el) => Boolean(el.closest("[hidden]")));
  expect(hidden).toBe(false);
  const text = ((await link.textContent()) ?? "").trim();
  const label = (await link.getAttribute("aria-label")) ?? text;
  expect(label === accessibleName || text === accessibleName).toBe(true);
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test.describe("footer copyright", () => {
  test.beforeEach(async ({ page }) => {
    await blockAnalytics(page);
    await stubShortTemplate(page);
  });

  test("shows © 2026 Yoiailabs in every locale and keeps the Nanatsukaze notice", async ({ page }) => {
    for (const [path, locale] of [
      ["/", "ja"],
      ["/en/", "en"],
      ["/ko/", "ko"],
      ["/zh/", "zh"],
    ] as const) {
      await page.goto(path);
      await waitForAppReady(page);
      await expect(page.locator(".site-footer-credit")).toHaveText(t(locale, "footerCopyright"));
      await expect(page.locator(".site-footer-notice")).toContainText(t(locale, "artistName"));
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  COMMUNITY_DESCRIPTION,
  COMMUNITY_DOCUMENT_TITLE,
  COMMUNITY_PAGE_META,
  COMMUNITY_PATH,
  isCommunityPath,
  MAKER_DESCRIPTION,
  MAKER_DOCUMENT_TITLE,
  MAKER_PAGE_META,
  OG_IMAGE_URL,
  ogImageUrl,
  pageMeta,
  rewriteHtmlPageMeta,
} from "./page-meta.ts";

const makerHtml = `<!doctype html>
<html lang="ja">
  <head>
    <title>${MAKER_DOCUMENT_TITLE}</title>
    <meta name="description" content="${MAKER_DESCRIPTION}" />
    <meta property="og:title" content="${MAKER_DOCUMENT_TITLE}" />
    <meta property="og:description" content="${MAKER_DESCRIPTION}" />
    <meta property="og:url" content="${MAKER_PAGE_META.url}" />
    <meta property="og:image" content="${OG_IMAGE_URL}" />
    <meta name="twitter:image" content="${OG_IMAGE_URL}" />
  </head>
  <body></body>
</html>
`;

describe("community path", () => {
  it("matches /community with or without a trailing slash", () => {
    expect(isCommunityPath("/community")).toBe(true);
    expect(isCommunityPath("/community/")).toBe(true);
    expect(isCommunityPath("/community?from=x")).toBe(true);
    expect(isCommunityPath("/")).toBe(false);
    expect(isCommunityPath("/community-jumps")).toBe(false);
    expect(isCommunityPath("/en/community")).toBe(true);
    expect(isCommunityPath("/ko/community/")).toBe(true);
    expect(isCommunityPath("/en")).toBe(false);
  });
});

describe("community page meta rewrite", () => {
  it("swaps title, description, and OGP on maker HTML", () => {
    expect(makerHtml).toContain(`<title>${MAKER_DOCUMENT_TITLE}</title>`);
    expect(makerHtml).toContain('content="https://anone.yoiailabs.com/"');

    const html = rewriteHtmlPageMeta(makerHtml);
    expect(html).toContain(`<title>${COMMUNITY_DOCUMENT_TITLE}</title>`);
    expect(html).not.toContain(`<title>${MAKER_DOCUMENT_TITLE}</title>`);
    expect(html).toContain(`name="description"`);
    expect(html).toContain(`content="${COMMUNITY_DESCRIPTION}"`);
    expect(html).toContain(`property="og:title"`);
    expect(html).toContain(`content="${COMMUNITY_DOCUMENT_TITLE}"`);
    expect(html).toContain(`property="og:url"`);
    expect(html).toContain(`content="${COMMUNITY_PAGE_META.url}"`);
    expect(html).toContain(`property="og:image"`);
    expect(html).toContain(`content="${OG_IMAGE_URL}"`);
    expect(html).toContain(`name="twitter:image"`);
    expect(html).toContain(COMMUNITY_PATH);
    expect(COMMUNITY_PAGE_META.url).toBe("https://anone.yoiailabs.com/community");
  });
});

describe("locale page meta", () => {
  it("uses a per-locale OG image and Open Graph locale", () => {
    expect(ogImageUrl("ja")).toBe(OG_IMAGE_URL);
    expect(ogImageUrl("en")).toBe("https://anone.yoiailabs.com/og-en.png");
    expect(pageMeta("en", "maker").ogLocale).toBe("en_US");
    expect(pageMeta("en", "maker").siteName).toBe("Anone Jump Maker");
    expect(pageMeta("ko", "community").image).toBe("https://anone.yoiailabs.com/og-ko.png");
    expect(pageMeta("zh", "maker").url).toBe("https://anone.yoiailabs.com/zh");
    expect(pageMeta("ja", "privacy").title).toBe("プライバシーポリシー");
    expect(pageMeta("ja", "privacy").url).toBe("https://anone.yoiailabs.com/privacy");
    expect(pageMeta("en", "privacy").url).toBe("https://anone.yoiailabs.com/en/privacy");
    expect(pageMeta("en", "privacy").siteName).toBe("Anone Jump Maker");
  });
});

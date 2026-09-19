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
    expect(isCommunityPath("/minna")).toBe(false);
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

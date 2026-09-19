import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import {
  COMMUNITY_DESCRIPTION,
  COMMUNITY_DOCUMENT_TITLE,
  COMMUNITY_PAGE_META,
  COMMUNITY_PATH,
  isCommunityPath,
  OG_IMAGE_URL,
  rewriteHtmlPageMeta,
} from "./page-meta.ts";

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
  it("swaps title, description, and OGP on the maker index.html", () => {
    expect(indexHtml).toContain("<title>あのねジャンプメーカー</title>");
    expect(indexHtml).toContain('content="https://anone.yoiailabs.com/"');

    const html = rewriteHtmlPageMeta(indexHtml);
    expect(html).toContain(`<title>${COMMUNITY_DOCUMENT_TITLE}</title>`);
    expect(html).not.toContain("<title>あのねジャンプメーカー</title>");
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

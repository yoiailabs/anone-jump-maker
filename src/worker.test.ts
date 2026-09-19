import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import worker from "../worker/index.ts";
import { COMMUNITY_DESCRIPTION, COMMUNITY_DOCUMENT_TITLE, COMMUNITY_PAGE_META } from "./page-meta.ts";

function assetsEnv(html = indexHtml) {
  return {
    ASSETS: {
      async fetch() {
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      },
    },
  };
}

describe("worker fetch", () => {
  it("returns 404 for non-community paths so wrangler [assets] can serve the maker", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/"), assetsEnv());
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("serves /community with community title, description, and OGP", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/community"),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/);
    const html = await response.text();
    expect(html).toContain(`<title>${COMMUNITY_DOCUMENT_TITLE}</title>`);
    expect(html).toContain(`content="${COMMUNITY_DESCRIPTION}"`);
    expect(html).toContain(`content="${COMMUNITY_PAGE_META.url}"`);
    expect(html).toContain('content="https://anone.yoiailabs.com/og.png"');
    expect(html).not.toContain("<title>あのねジャンプメーカー</title>");
  });

  it("treats /community/ the same as /community", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/community/"),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`<title>${COMMUNITY_DOCUMENT_TITLE}</title>`);
  });
});

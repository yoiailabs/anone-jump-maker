import { describe, expect, it } from "vitest";
import worker from "../worker/index.ts";

function assetsEnv(body = "<html lang=\"ja\">maker</html>") {
  return {
    ASSETS: {
      async fetch() {
        return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
      },
    },
  };
}

describe("worker fetch", () => {
  it("returns 404 for non-page paths so wrangler [assets] can serve them", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/og.png"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("lets prefixed locales fall through to static HTML", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/en"));
    expect(response.status).toBe(404);
  });

  it("serves Japanese HTML when the browser prefers Japanese", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", { headers: { "accept-language": "ja-JP,ja;q=0.9" } }),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("maker");
    expect(response.headers.get("vary")).toMatch(/Accept-Language/);
  });

  it("redirects / to /en when Accept-Language prefers English", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", { headers: { "accept-language": "en-US,en;q=0.9" } }),
      assetsEnv(),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/en");
  });

  it("redirects /community to a prefixed community path for Korean", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/community?from=x", {
        headers: { "accept-language": "ko" },
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/ko/community?from=x");
  });

  it("lets a language cookie override Accept-Language", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", {
        headers: { "accept-language": "ja", cookie: "anone-locale=zh" },
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/zh");
  });

  it("canonicalizes /ja onto /", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/ja"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
  });
});

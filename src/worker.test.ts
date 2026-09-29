import { describe, expect, it } from "vitest";
import worker from "../worker/index.ts";

const JA_HTML = `<html lang="ja"><head><title>あのねジャンプメーカー</title><meta property="og:title" content="あのねジャンプメーカー" /><meta property="og:locale" content="ja_JP" /></head><body>maker</body></html>`;

function assetsEnv(body = JA_HTML) {
  return {
    ASSETS: {
      async fetch() {
        return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
      },
    },
  };
}

describe("worker fetch", () => {
  it("returns 404 for non-page paths so Workers assets can serve them", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/og.png"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("lets prefixed locales fall through to static HTML", async () => {
    const response = await worker.fetch(new Request("https://anone.yoiailabs.com/en"));
    expect(response.status).toBe(404);
    const privacy = await worker.fetch(new Request("https://anone.yoiailabs.com/en/privacy"));
    expect(privacy.status).toBe(302);
    expect(privacy.headers.get("location")).toBe("/privacy");
    const terms = await worker.fetch(new Request("https://anone.yoiailabs.com/ko/terms?from=x"));
    expect(terms.status).toBe(302);
    expect(terms.headers.get("location")).toBe("/terms?from=x");
  });

  it("serves Japanese HTML when the browser prefers Japanese", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", { headers: { "accept-language": "ja-JP,ja;q=0.9" } }),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("あのねジャンプメーカー");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("asks ASSETS for the original URL so auto-trailing-slash cannot loop", async () => {
    let fetched = "";
    const env = {
      ASSETS: {
        async fetch(input: Request | URL) {
          const href = input instanceof Request ? input.url : String(input);
          fetched = new URL(href, "https://anone.yoiailabs.com").pathname;
          return new Response("<html lang=\"ja\">maker</html>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    };
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", { headers: { "accept-language": "ja" } }),
      env,
    );
    expect(response.status).toBe(200);
    expect(fetched).toBe("/");
  });

  it("keeps Japanese HTML on / even when Accept-Language prefers English", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", {
        headers: {
          "accept-language": "en-US,en;q=0.9",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      }),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('lang="ja"');
    expect(html).toContain('property="og:title" content="あのねジャンプメーカー"');
    expect(html).toContain('property="og:locale" content="ja_JP"');
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("keeps Japanese HTML on /community when Accept-Language is Korean", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/community?from=x", {
        headers: { "accept-language": "ko" },
      }),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects /make when a language cookie is set", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/make", {
        headers: { cookie: "anone-locale=en" },
      }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/en/make");
  });

  it("redirects / when a language cookie is set", async () => {
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

  it("serves /privacy and redirects it with the locale cookie", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/privacy", {
        headers: { "accept-language": "en" },
      }),
      assetsEnv("<html lang=\"ja\"><title>プライバシーポリシー</title></html>"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("プライバシーポリシー");

    const stayed = await worker.fetch(
      new Request("https://anone.yoiailabs.com/privacy", {
        headers: { cookie: "anone-locale=en" },
      }),
      assetsEnv("<html lang=\"ja\"><title>プライバシーポリシー</title></html>"),
    );
    expect(stayed.status).toBe(200);
    expect(await stayed.text()).toContain("プライバシーポリシー");

    const canonical = await worker.fetch(new Request("https://anone.yoiailabs.com/ja/privacy"));
    expect(canonical.status).toBe(302);
    expect(canonical.headers.get("location")).toBe("/privacy");
  });

  it("serves /terms and redirects it with the locale cookie", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/terms", {
        headers: { "accept-language": "en" },
      }),
      assetsEnv("<html lang=\"ja\"><title>利用規約</title></html>"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("利用規約");

    const stayed = await worker.fetch(
      new Request("https://anone.yoiailabs.com/terms", {
        headers: { cookie: "anone-locale=en" },
      }),
      assetsEnv("<html lang=\"ja\"><title>利用規約</title></html>"),
    );
    expect(stayed.status).toBe(200);
    expect(await stayed.text()).toContain("利用規約");

    const canonical = await worker.fetch(new Request("https://anone.yoiailabs.com/ja/terms"));
    expect(canonical.status).toBe(302);
    expect(canonical.headers.get("location")).toBe("/terms");
  });

  it("serves Japanese / to Googlebot even when Accept-Language is English", async () => {
    const response = await worker.fetch(
      new Request("https://anone.yoiailabs.com/", {
        headers: {
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
      }),
      assetsEnv(),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("あのねジャンプメーカー");
    expect(html).toContain("ja_JP");
  });

  it("does not language-redirect Twitterbot, Facebook, or LINE on /", async () => {
    for (const userAgent of [
      "Twitterbot/1.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari Line/13.6.0",
    ]) {
      const response = await worker.fetch(
        new Request("https://anone.yoiailabs.com/", {
          headers: { "accept-language": "en", "user-agent": userAgent },
        }),
        assetsEnv(),
      );
      expect(response.status, userAgent).toBe(200);
      expect(await response.text()).toContain('og:title" content="あのねジャンプメーカー"');
    }
  });
});

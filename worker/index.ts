import { isJapaneseOnlyView, localeRedirectLocation, parseAppPath, pathForApp } from "../src/i18n.ts";

type AssetsEnv = {
  ASSETS?: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> };
};

/** Cookie の言語選択だけ HTTP で寄せる。Accept-Language は使わない。 */
const VARY = "Cookie";

/**
 * 静的アセットは Workers の assets が配信する。
 * プレフィックスなしの `/` `/community` `/privacy` `/terms` は日本語 HTML（SEO / OGP）を返す。
 * ブラウザの言語寄せはクライアント JS。Cookie があるときだけ 302 する。
 * `/en/privacy` など規約・ポリシーの言語付き URL は日本語の正規 URL へ 302 する。
 */
export default {
  async fetch(request: Request, env: AssetsEnv = {}): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Not found", { status: 404 });
    }
    const url = new URL(request.url);
    const parsed = parseAppPath(url.pathname);
    if (!parsed) {
      return new Response("Not found", { status: 404 });
    }
    if (isJapaneseOnlyView(parsed.view) && parsed.prefixed) {
      return new Response(null, {
        status: 302,
        headers: {
          location: `${pathForApp("ja", parsed.view)}${url.search}`,
          vary: VARY,
          "cache-control": "private, no-store",
        },
      });
    }
    if (parsed.prefixed && parsed.locale !== "ja") {
      return new Response("Not found", { status: 404 });
    }

    const dest = localeRedirectLocation(
      url.pathname,
      url.search,
      request.headers.get("cookie"),
      request.headers.get("accept-language"),
      request.headers.get("user-agent"),
      { acceptLanguageRedirect: false },
    );
    if (dest) {
      return new Response(null, {
        status: 302,
        headers: {
          location: dest,
          vary: VARY,
          "cache-control": "private, no-store",
        },
      });
    }

    if (!env.ASSETS) {
      return new Response("Not found", { status: 404 });
    }
    // html_handling = auto-trailing-slash は /index.html を / へ 307 する。
    // Worker が / を先に受けるため、それをそのまま返すと無限リダイレクトになる。
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("vary", VARY);
    return new Response(asset.body, { status: asset.status, headers });
  },
};

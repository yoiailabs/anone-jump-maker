import { localeRedirectLocation, parseAppPath } from "../src/i18n.ts";

type AssetsEnv = {
  ASSETS?: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> };
};

/**
 * 静的アセットは wrangler の [assets] が配信する。
 * プレフィックスなしのページだけ Worker が言語ネゴシエーションする。
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
    if (parsed.prefixed && parsed.locale !== "ja") {
      return new Response("Not found", { status: 404 });
    }

    const dest = localeRedirectLocation(
      url.pathname,
      url.search,
      request.headers.get("cookie"),
      request.headers.get("accept-language"),
    );
    if (dest) {
      return new Response(null, {
        status: 302,
        headers: {
          location: dest,
          vary: "Accept-Language, Cookie",
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
    headers.set("vary", "Accept-Language, Cookie");
    return new Response(asset.body, { status: asset.status, headers });
  },
};

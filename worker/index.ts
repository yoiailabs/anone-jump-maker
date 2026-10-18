import {
  isJapaneseOnlyView,
  localeRedirectLocation,
  parseAppPath,
  pathForApp,
  retiredCommunityRedirect,
} from "../src/i18n.ts";

type AssetsEnv = {
  ASSETS?: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> };
};

/** Cookie の言語選択だけ HTTP で寄せる。Accept-Language は使わない。 */
const VARY = "Cookie";

/**
 * 静的アセットは Workers の assets が配信する。
 * プレフィックスなしの `/` `/privacy` `/terms` は日本語 HTML（SEO / OGP）を返す。
 * ブラウザの言語寄せはクライアント JS。Cookie があるときだけ 302 する。
 * `/en/privacy` など規約・ポリシーの言語付き URL は日本語の正規 URL へ 302 する。
 * 廃止した `/community` と `/<locale>/community` は各言語のトップへ 301 する。
 */
export default {
  async fetch(request: Request, env: AssetsEnv = {}): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Not found", { status: 404 });
    }
    const url = new URL(request.url);
    // `/_astro/*` は _headers で 1 年 immutable。無いファイルは SPA が index.html を
    // 200 text/html で返すので、そのまま渡すと HTML がスクリプト URL に張り付き、
    // 起動せず写真を選んでも読み込まれない。HTML のときは no-store の 404 にする。
    if (url.pathname.startsWith("/_astro/")) {
      return hashedAsset(request, env);
    }
    const retired = retiredCommunityRedirect(url.pathname, url.search);
    if (retired) {
      return new Response(null, {
        status: 301,
        headers: {
          location: retired,
          "cache-control": "public, max-age=86400",
        },
      });
    }
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

async function hashedAsset(request: Request, env: AssetsEnv): Promise<Response> {
  if (!env.ASSETS) return scriptMiss();
  const asset = await env.ASSETS.fetch(request);
  const contentType = asset.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("text/html")) {
    await asset.body?.cancel();
    return scriptMiss();
  }
  return asset;
}

function scriptMiss(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

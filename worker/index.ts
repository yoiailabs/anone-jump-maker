import { COMMUNITY_PAGE_META, isCommunityPath, rewriteHtmlPageMeta } from "../src/page-meta.ts";

/**
 * 静的アセットは wrangler の [assets] が配信する。
 * `/community` だけ Worker が先に受け、index.html の head をコミュニティ用 OGP に差し替える。
 */
type AssetsEnv = {
  ASSETS?: { fetch(input: Request | URL, init?: RequestInit): Promise<Response> };
};

export default {
  async fetch(request: Request, env: AssetsEnv = {}): Promise<Response> {
    const url = new URL(request.url);
    if (!isCommunityPath(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }
    if (!env.ASSETS) {
      return new Response("Not found", { status: 404 });
    }
    const shell = await env.ASSETS.fetch(new URL("/index.html", url));
    if (!shell.ok) return shell;
    const rewritten = rewriteHtmlPageMeta(await shell.text(), COMMUNITY_PAGE_META);
    const headers = new Headers(shell.headers);
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(rewritten, { status: 200, headers });
  },
};

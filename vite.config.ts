import { readFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";
import { COMMUNITY_PAGE_META, isCommunityPath, rewriteHtmlPageMeta } from "./src/page-meta.ts";

/** `/community` でも Worker と同じ head / OGP を返す。ビルド後の index.html はメーカーのまま。 */
function communityPageMeta() {
  const serve = (
    load: () => Promise<string>,
    transform?: (html: string, url: string) => Promise<string>,
  ) => {
    return (req: { url?: string; method?: string }, res: { setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => {
      const rawUrl = req.url ?? "";
      const pathname = rawUrl.split("?")[0] ?? "";
      if ((req.method !== "GET" && req.method !== "HEAD") || !isCommunityPath(pathname)) {
        next();
        return;
      }
      void (async () => {
        try {
          let html = await load();
          if (transform) html = await transform(html, rawUrl);
          html = rewriteHtmlPageMeta(html, COMMUNITY_PAGE_META);
          res.setHeader("content-type", "text/html; charset=utf-8");
          res.end(html);
        } catch {
          next();
        }
      })();
    };
  };

  return {
    name: "community-page-meta",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        serve(
          () => readFile(path.resolve("index.html"), "utf8"),
          (html, url) => server.transformIndexHtml(url, html),
        ),
      );
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(serve(() => readFile(path.resolve("dist/index.html"), "utf8")));
    },
  };
}

export default defineConfig({
  plugins: [communityPageMeta()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
    sourcemap: true,
  },
});

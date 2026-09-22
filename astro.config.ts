import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  site: "https://anone.yoiailabs.com",
  output: "static",
  redirects: {
    "/community": "/",
    "/ja/community": "/",
    "/en/community": "/en",
    "/ko/community": "/ko",
    "/zh/community": "/zh",
    "/en/privacy": "/privacy",
    "/ko/privacy": "/privacy",
    "/zh/privacy": "/privacy",
    "/en/terms": "/terms",
    "/ko/terms": "/terms",
    "/zh/terms": "/terms",
  },
  trailingSlash: "ignore",
  i18n: {
    defaultLocale: "ja",
    locales: ["ja", "en", "ko", "zh"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [react()],
  server: ({ command }) => ({
    host: true,
    port: command === "preview" ? 4173 : 5173,
  }),
  vite: {
    envPrefix: ["PUBLIC_", "VITE_"],
    resolve: { alias: { "@": src } },
    plugins: [tailwindcss()],
    build: {
      target: "es2022",
      assetsInlineLimit: 0,
      // dist は Workers の静的アセットとしてそのまま公開される。
      // 開発サーバー (astro dev) のソースマップはこれとは別で、手元のデバッグには残る。
      sourcemap: false,
    },
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { applyWorkersCiTelemetryGate } from "./src/telemetry-build.ts";

// Vite が import.meta.env へコピーする前に外す。Preview の束に DSN と測定 ID を残さない。
const telemetryDsnSet = Boolean(process.env.VITE_SENTRY_DSN?.trim());
const telemetryGaSet = Boolean(process.env.PUBLIC_GA4_MEASUREMENT_ID?.trim());
const embedTelemetry = applyWorkersCiTelemetryGate(process.env);
if (process.env.WORKERS_CI?.trim()) {
  console.info(
    `[telemetry] WORKERS_CI_BRANCH=${process.env.WORKERS_CI_BRANCH ?? ""} embed=${embedTelemetry ? "yes" : "no"} dsn=${telemetryDsnSet ? "set" : "unset"} ga=${telemetryGaSet ? "set" : "unset"}`,
  );
}

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  site: "https://anone.yoiailabs.com",
  output: "static",
  redirects: {
    "/en/privacy": "/privacy",
    "/ko/privacy": "/privacy",
    "/zh/privacy": "/privacy",
    "/en/terms": "/terms",
    "/ko/terms": "/terms",
    "/zh/terms": "/terms",
    "/community": { status: 301, destination: "/" },
    "/ja/community": { status: 301, destination: "/" },
    "/en/community": { status: 301, destination: "/en" },
    "/ko/community": { status: 301, destination: "/ko" },
    "/zh/community": { status: 301, destination: "/zh" },
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

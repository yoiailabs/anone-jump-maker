import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  output: "static",
  trailingSlash: "ignore",
  integrations: [react()],
  vite: {
    envPrefix: ["PUBLIC_", "VITE_"],
    resolve: { alias: { "@": src } },
    plugins: [tailwindcss()],
    build: {
      target: "es2022",
      assetsInlineLimit: 0,
      sourcemap: true,
    },
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  },
});

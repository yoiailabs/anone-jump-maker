import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    name: "unit",
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.browser.test.ts"],
  },
});

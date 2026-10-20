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
    // 共有実行環境で fork の起動が集中しないよう、同時実行数を制限する。
    maxWorkers: 2,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.browser.test.ts"],
  },
});

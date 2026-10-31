// 入力は compositor.test.ts 内の表を使い、現行の公開関数から期待値を再採録する。
// 実行: node scripts/update-frame-boundaries.mjs。その後、JSON の差分を確認する。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("node_modules/vitest/vitest.mjs", root)),
  "run", "src/compositor.test.ts", "-t", "frame boundary safety table",
], {
  cwd: root,
  env: { ...process.env, UPDATE_FRAME_BOUNDARIES: "1" },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

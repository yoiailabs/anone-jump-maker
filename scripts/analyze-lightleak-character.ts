/**
 * node scripts/analyze-lightleak-character.ts
 * ffmpeg と既存のキー関数でカット時点のアルファ重心を事前計算する。
 * 実行時の動画デコード・GPU・シーク順に光源位置を依存させない。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { characterAlphaCenter } from "./lightleak-character-center.ts";
import { templateBandRect } from "../src/layout.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const cuts = JSON.parse(readFileSync(`${root}public/official-assets/template/landscape-cuts.json`, "utf8"));
const video = `${root}${cuts.source}`;
const width = 320, height = 180, stride = width * height * 4;
// 全フレームを一度だけデコードし、固定と追従の比較にも同じ映像を使う。
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", video, "-vf", `scale=${width}:${height}`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 128 * 1024 * 1024 });
const frames = Math.floor(raw.length / stride);
const centers = { landscape: [] as ({ x: number; y: number } | null)[], portrait: [] as ({ x: number; y: number } | null)[] };
for (const mode of ["landscape", "portrait"] as const) {
  const band = templateBandRect(width, height, mode);
  for (let frame = 0; frame < frames; frame++) {
    const data = new Uint8ClampedArray(width * band.h * 4);
    data.set(raw.subarray(frame * stride + band.y * width * 4, frame * stride + (band.y + band.h) * width * 4));
    centers[mode].push(characterAlphaCenter(data, width, band.h));
  }
}
const result = {
  source: cuts.source,
  sha256: createHash("sha256").update(readFileSync(video)).digest("hex"),
  analysisSize: [width, height],
  // カットの番号ではなく実フレームを保存し、異なるタイムラインでは誤用しない。
  cuts: cuts.slotFrames.map((frame: number) => ({ frame, landscape: centers.landscape[frame], portrait: centers.portrait[frame] })),
};
writeFileSync(`${root}src/generated/lightleak-character.json`, JSON.stringify(result, null, 2) + "\n");
for (const mode of ["landscape", "portrait"] as const) {
  let max = 0, total = 0, count = 0;
  for (const cut of cuts.slotFrames.slice(1)) {
    const fixed = centers[mode][cut]!;
    if (!fixed) continue;
    for (let f = cut - 4; f <= cut + 4; f++) {
      const moving = centers[mode][f]!;
      if (!moving) continue;
      const distance = Math.hypot(moving.x - fixed.x, moving.y - fixed.y);
      max = Math.max(max, distance); total += distance; count++;
    }
  }
  console.log(`${mode}: fixed vs tracking normalized plate displacement mean=${(total / count).toFixed(6)} max=${max.toFixed(6)}`);
}
// 比較画像を作るときだけ全フレームの中心を一時出力する。リポにはカット表だけ残す。
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(centers));
console.log(`wrote ${result.cuts.length} cut centers`);

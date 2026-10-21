/** node scripts/analyze-chara-iris-track.ts — 実行時の画素読み戻しを避ける30fps追跡表。 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { keyAlpha, sampleKeyColor } from "../src/keying.ts";
import { templateBandRect, TEMPLATE_FPS } from "../src/layout.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = "public/official-assets/template/landscape.mp4";
const width = 480, height = 270, stride = width * height * 4;
const raw = execFileSync("ffmpeg", ["-v", "error", "-i", `${root}${source}`, "-vf", `scale=${width}:${height}`, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 256 * 1024 * 1024 });
const diagnostics: { frame: number; bbox: number[]; centroid: number[] }[] = [];
const tracks = {} as Record<"landscape" | "portrait", number[][]>;
for (const mode of ["landscape", "portrait"] as const) {
  const band = templateBandRect(width, height, mode);
  const frames: number[][] = [];
  for (let frame = 0; frame < raw.length / stride; frame++) {
    const data = new Uint8ClampedArray(raw.subarray(frame * stride + band.y * width * 4, frame * stride + (band.y + band.h) * width * 4));
    const key = sampleKeyColor(data, width, band.h);
    const rows = new Float64Array(band.h), cols = new Float64Array(width);
    let mass = 0, sumX = 0, sumY = 0;
    for (let y = 0; y < band.h; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const a = keyAlpha(data[i]!, data[i + 1]!, data[i + 2]!, ...key);
        mass += a; sumX += (x + 0.5) * a; sumY += (y + 0.5) * a;
        if (a >= 0.5) { rows[y]!++; cols[x]!++; }
      }
    }
    // 孤立した圧縮ノイズを除いた外接矩形。腕・足のインクも残す低い閾値。
    const xs = [...cols.keys()].filter((x) => cols[x]! >= 3);
    const ys = [...rows.keys()].filter((y) => rows[y]! >= 3);
    const center = mass > width * band.h * 0.002 && xs.length && ys.length
      ? [(xs[0]! + xs.at(-1)! + 1) / (2 * width), (ys[0]! + ys.at(-1)! + 1) / (2 * band.h)]
      : frames.at(-1) ?? [0.5, 0.5];
    frames.push(center.map((v) => Number(v.toFixed(6))));
    if (process.argv[2] && mode === "landscape") {
      // 見た目の判断に使う比較値だけ一時出力（製品の表には含めない）。
      diagnostics.push({ frame, bbox: center, centroid: [sumX / mass / width, sumY / mass / band.h] });
    }
  }
  tracks[mode] = frames;
}
const result = { source, sha256: createHash("sha256").update(readFileSync(`${root}${source}`)).digest("hex"), fps: TEMPLATE_FPS, analysisSize: [width, height], method: "alpha>=0.5 bbox, >=3 foreground pixels per row/column; missing: previous or plate center", ...tracks };
mkdirSync(`${root}src/generated`, { recursive: true });
writeFileSync(`${root}src/generated/chara-iris-track.json`, JSON.stringify(result) + "\n");
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(diagnostics));
console.log(`wrote ${tracks.landscape.length} frames per mode, sha256=${result.sha256}`);

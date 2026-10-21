import { keyAlpha, sampleKeyColor } from "../src/keying.ts";

/** 事前計算専用。実行時にはこの解析を呼ばず、生成済みの表だけを使う。 */
export function characterAlphaCenter(data: Uint8ClampedArray, width: number, height: number) {
  const key = sampleKeyColor(data, width, height);
  let mass = 0, sx = 0, sy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = keyAlpha(data[i]!, data[i + 1]!, data[i + 2]!, ...key) * data[i + 3]! / 255;
      // 圧縮ノイズ・キーの薄い緑残りを重心に混ぜない。
      if (alpha < 0.5) continue;
      mass += alpha; sx += (x + 0.5) * alpha; sy += (y + 0.5) * alpha;
    }
  }
  return mass < width * height * 0.001 ? null : { x: +(sx / mass / width).toFixed(6), y: +(sy / mass / height).toFixed(6) };
}

import type { AspectMode, SwapStyle } from "./layout.ts";
import { TEMPLATE_PHOTO_COUNT } from "./timeline.ts";

/** 保存ファイル名。向きと切替を含める。 */
export function exportFileName(mode: AspectMode, style: SwapStyle, extension: string): string {
  const aspectTag = mode === "landscape" ? "16x9" : "9x16";
  return `anone-${style}-${aspectTag}.${extension}`;
}

/** 読み込んだ枚数に応じて、テンプレの並び（10 枚）とどう対応させるかを一言で。 */
export function describePhotoCount(count: number): string {
  if (count <= 0) return "";
  if (count < TEMPLATE_PHOTO_COUNT) {
    return `テンプレは ${TEMPLATE_PHOTO_COUNT} 枚想定なので、${count} 枚を順にくり返します。`;
  }
  if (count === TEMPLATE_PHOTO_COUNT) {
    return `テンプレと同じ ${TEMPLATE_PHOTO_COUNT} 枚。参考どおりの並びで 32 カットに入ります。`;
  }
  return `最初の ${TEMPLATE_PHOTO_COUNT} 枚はテンプレの並び、${count - TEMPLATE_PHOTO_COUNT} 枚は同じ写真が再登場する位置に入ります。`;
}

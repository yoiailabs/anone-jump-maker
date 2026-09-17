import { ASPECT_LABELS, SWAP_STYLE_LABELS, type AspectMode, type SwapStyle } from "./layout.ts";

/** 「縦 × ジャンプ」のような 2×2 の組み合わせ名。 */
export function formatModeLabel(mode: AspectMode, style: SwapStyle): string {
  return `${ASPECT_LABELS[mode]} × ${SWAP_STYLE_LABELS[style]}`;
}

export function describeMode(mode: AspectMode, style: SwapStyle): string {
  const frame = mode === "portrait" ? "たて（9:16）。中央が本編、上下はブラー。" : "よこ（16:9）。全面が本編。";
  const swap =
    style === "zoom"
      ? "切替はズーム（縮んで横ブレ、新しい写真が寄りから引く）。"
      : "切替はジャンプ（沈んで白フラッシュ、跳ね戻る）。";
  return `${frame}${swap}`;
}

/** 保存ファイル名。向きと切替を含める。 */
export function exportFileName(mode: AspectMode, style: SwapStyle, extension: string): string {
  const aspectTag = mode === "landscape" ? "16x9" : "9x16";
  return `anone-${style}-${aspectTag}.${extension}`;
}

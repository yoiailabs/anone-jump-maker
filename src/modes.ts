import type { AspectMode, SwapStyle } from "./layout.ts";

/** 保存ファイル名。向きと切替を含める。 */
export function exportFileName(mode: AspectMode, style: SwapStyle, extension: string): string {
  const aspectTag = mode === "landscape" ? "16x9" : "9x16";
  return `anone-${style}-${aspectTag}.${extension}`;
}

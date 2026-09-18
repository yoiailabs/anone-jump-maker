import type { AspectMode, ImageFilter, SwapStyle } from "./layout.ts";

/** 保存ファイル名。向き・切替・フィルターを含める。なしは従来どおり省略。 */
export function exportFileName(
  mode: AspectMode,
  style: SwapStyle,
  extension: string,
  filter: ImageFilter = "none",
): string {
  const aspectTag = mode === "landscape" ? "16x9" : "9x16";
  const filterTag = filter === "none" ? "" : `-${filter}`;
  return `anone-${style}-${aspectTag}${filterTag}.${extension}`;
}

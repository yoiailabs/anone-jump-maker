import type { ColorFilter } from "./color-filter.ts";
import type { AspectMode, ImageFilter, SwapStyle } from "./layout.ts";

/** 保存ファイル名。向き・切替・フィルターを含める。なしは従来どおり省略。 */
export function exportFileName(
  mode: AspectMode,
  style: SwapStyle,
  extension: string,
  filter: ImageFilter = "none",
  colorFilter: ColorFilter = "none",
): string {
  const aspectTag = mode === "landscape" ? "16x9" : "9x16";
  const filterTag = filter === "none" ? "" : `-${filter}`;
  const colorTag = colorFilter === "none" ? "" : `-${colorFilter}`;
  return `anone-${style}-${aspectTag}${filterTag}${colorTag}.${extension}`;
}

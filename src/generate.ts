import type { AspectMode, ImageFilter, SwapStyle } from "./layout.ts";
import type { ExportResult } from "./export.ts";

/** 生成は先にオフラインで行い、プレビューと保存は同じ成果物を使う。 */
export const GENERATE_FLOW = "generate-first" as const;

/**
 * 画素の重い処理は WASM。エンコード／mux は WebCodecs + mediabunny。
 * ffmpeg.wasm は Android Chrome のメモリと COOP/COEP の都合で本線にしない。
 */
export const GENERATE_PIXEL_ENGINE = "wasm" as const;
export const GENERATE_ENCODER = "webcodecs-mediabunny" as const;

export const GENERATE_LABEL = "生成";
export const REGENERATE_LABEL = "再生成";
export const GENERATE_PREPARE_STATUS = "書き出しを準備しています…";
export const GENERATE_READY_STATUS = "できました。プレビューするか、保存できます。";
export const GENERATE_STALE_STATUS = "設定が変わったので、もう一度生成してください。";
export const GENERATE_PHOTOS_HINT = "何枚でも。テンプレは 10 枚を 32 カットに並べ直します。少なければ順にくり返します。";

export const MEMORY_ERROR_MESSAGE =
  "メモリが足りません。写真の枚数を減らすか、横のまま生成してみてください。";

export type GenerateSettings = {
  aspect: AspectMode;
  swap: SwapStyle;
  filter: ImageFilter;
  photoIds: readonly string[];
};

export type GeneratedArtifact = ExportResult & {
  url: string;
  filename: string;
  key: string;
};

export function settingsFingerprint(settings: GenerateSettings): string {
  return `${settings.aspect}|${settings.swap}|${settings.filter}|${settings.photoIds.join("\0")}`;
}

export function isArtifactCurrent(key: string | null | undefined, settings: GenerateSettings): boolean {
  return Boolean(key) && key === settingsFingerprint(settings);
}

export function generateButtonLabel(hasCurrentArtifact: boolean): string {
  return hasCurrentArtifact ? REGENERATE_LABEL : GENERATE_LABEL;
}

export function generateProgressText(current: number, total: number): string {
  return `生成中… ${current} / ${total}`;
}

export function photosLoadedStatus(count: number): string {
  if (count <= 0) return "画像ファイルを選んでください";
  return `${count} 枚を読み込みました。向き・エフェクト・フィルターを選んで生成できます。`;
}

export type ActionAvailability = {
  canGenerate: boolean;
  canPreview: boolean;
  canSave: boolean;
};

export function actionAvailability(input: {
  generating: boolean;
  photosReady: boolean;
  templateReady: boolean;
  hasCurrentArtifact: boolean;
}): ActionAvailability {
  const inputsReady = input.photosReady && input.templateReady;
  return {
    canGenerate: !input.generating && inputsReady,
    canPreview: !input.generating && input.hasCurrentArtifact,
    canSave: !input.generating && input.hasCurrentArtifact,
  };
}

export function isMemoryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    error.name === "RangeError" ||
    error.name === "QuotaExceededError" ||
    /out of memory|array buffer|allocation failed|oom|memory/i.test(text)
  );
}

export function generationErrorMessage(error: unknown, fallback = "生成に失敗しました"): string {
  if (isMemoryError(error)) return MEMORY_ERROR_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function revokeGeneratedArtifact(artifact: GeneratedArtifact | null | undefined): void {
  if (!artifact) return;
  URL.revokeObjectURL(artifact.url);
}

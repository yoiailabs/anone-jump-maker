import type { ColorFilter } from "./color-filter.ts";
import {
  TEMPLATE_DECODE_MESSAGE,
  TEMPLATE_FRAME_FROZEN_MESSAGE,
  TEMPLATE_FRAME_MISSING_MESSAGE,
  UNSUPPORTED_EXPORT_MESSAGE,
} from "./export.ts";
import type { AspectMode, ImageFilter, SwapStyle } from "./layout.ts";
import { MESSAGES } from "./messages.ts";

/**
 * GA4 カスタムイベント。測定 ID はビルド時の PUBLIC_GA4_MEASUREMENT_ID。
 * gtag が無い（未設定・テスト・ブロック・未ロード）ときは何もしない。
 * パラメータに写真名、ファイル名、画像バイトは載せない。
 *
 * 既存:
 * - video_preview
 * - video_save
 *
 * 制作ファネル:
 * - photo_picker_open … ファイル／写真ピッカーを開いた
 * - photos_selected … 1 枚以上読み込めた（count）
 * - photos_rejected … 枚数・形式の検証で 0 枚（reason）
 * - generate_start … 書き出しを開始した（count）
 * - generate_fail … 書き出しが失敗した（reason。短いコードのみ）
 * - generate_cancel … 書き出しをキャンセルした
 * - make_open … ランディングから制作画面を開いた（直リンクの初回表示も含む）
 */
export const VIDEO_PREVIEW_EVENT = "video_preview";
export const VIDEO_SAVE_EVENT = "video_save";
export const PHOTO_PICKER_OPEN_EVENT = "photo_picker_open";
export const PHOTOS_SELECTED_EVENT = "photos_selected";
export const PHOTOS_REJECTED_EVENT = "photos_rejected";
export const GENERATE_START_EVENT = "generate_start";
export const GENERATE_FAIL_EVENT = "generate_fail";
export const GENERATE_CANCEL_EVENT = "generate_cancel";
export const MAKE_OPEN_EVENT = "make_open";

export type AnalyticsEventName =
  | typeof VIDEO_PREVIEW_EVENT
  | typeof VIDEO_SAVE_EVENT
  | typeof PHOTO_PICKER_OPEN_EVENT
  | typeof PHOTOS_SELECTED_EVENT
  | typeof PHOTOS_REJECTED_EVENT
  | typeof GENERATE_START_EVENT
  | typeof GENERATE_FAIL_EVENT
  | typeof GENERATE_CANCEL_EVENT
  | typeof MAKE_OPEN_EVENT;

/** 設定値だけ。写真名やファイルは載せない。 */
export type AnalyticsEventParams = {
  aspect: AspectMode;
  effect: SwapStyle;
  swap: SwapStyle;
  filter: ImageFilter;
  color_filter: ColorFilter;
};

/** ファネル用。count と短い reason だけ。 */
export type FunnelEventParams = {
  count?: number;
  reason?: string;
};

export type AnalyticsParams = AnalyticsEventParams | FunnelEventParams;

type GtagFn = (command: "event", name: AnalyticsEventName, params?: AnalyticsParams) => void;

const GENERATE_FAIL_REASONS: ReadonlyArray<readonly [string, string]> = [
  [UNSUPPORTED_EXPORT_MESSAGE, "unsupported"],
  [TEMPLATE_DECODE_MESSAGE, "template_decode"],
  [TEMPLATE_FRAME_MISSING_MESSAGE, "template_frame"],
  [TEMPLATE_FRAME_FROZEN_MESSAGE, "template_frozen"],
  [MESSAGES.ja.errorCanvas2d, "canvas"],
  [MESSAGES.ja.errorExportBuffer, "empty_buffer"],
  [MESSAGES.ja.statusCutsFailed, "cuts"],
  [MESSAGES.ja.statusCutsMissing, "cuts"],
  [MESSAGES.ja.statusTemplateLoadFailed, "template"],
];

const recentFireAt = new Map<string, number>();

/** テストがデバウンス時刻を次のケースへ持ち越さないようにする。 */
export function resetTrackDebounce(): void {
  recentFireAt.clear();
}

function hostGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const gtag = window.gtag;
  return typeof gtag === "function" ? (gtag as GtagFn) : undefined;
}

export function videoEventParams(
  aspect: AspectMode, effect: SwapStyle, filter: ImageFilter = "none", colorFilter: ColorFilter = "none",
): AnalyticsEventParams {
  return { aspect, effect, swap: effect, filter, color_filter: colorFilter };
}

/** 既知の書き出しエラーだけ短い reason にする。未知の文面はそのまま送らない。 */
export function generateFailReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const known = GENERATE_FAIL_REASONS.find(([message]) => message === raw);
  if (known) return known[1];
  if (raw.startsWith(`${MESSAGES.ja.statusTemplateLoadFailed} (`)) return "template";
  return "export_failed";
}

export type TrackEventOptions = {
  /** 同じイベント名の連続発火（label と input の二重 click など）を落とす。 */
  debounceMs?: number;
};

/** gtag が無いときは何もしない。debounceMs 内の同名イベントは 1 回だけ送る。 */
export function trackEvent(
  name: AnalyticsEventName,
  params?: AnalyticsParams,
  options?: TrackEventOptions,
): void {
  const debounceMs = options?.debounceMs ?? 0;
  if (debounceMs > 0) {
    const now = Date.now();
    const previous = recentFireAt.get(name) ?? 0;
    if (now - previous < debounceMs) return;
    recentFireAt.set(name, now);
  }
  const gtag = hostGtag();
  if (!gtag) return;
  if (params) gtag("event", name, params);
  else gtag("event", name);
}

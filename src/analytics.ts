import type { AspectMode, SwapStyle } from "./layout.ts";

export const VIDEO_PREVIEW_EVENT = "video_preview";
export const VIDEO_SAVE_EVENT = "video_save";

export type AnalyticsEventName = typeof VIDEO_PREVIEW_EVENT | typeof VIDEO_SAVE_EVENT;

/** 向きとエフェクトだけ。写真名やファイルは載せない。 */
export type AnalyticsEventParams = {
  aspect: AspectMode;
  effect: SwapStyle;
  swap: SwapStyle;
};

type GtagFn = (command: "event", name: AnalyticsEventName, params?: AnalyticsEventParams) => void;

function hostGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const gtag = window.gtag;
  return typeof gtag === "function" ? (gtag as GtagFn) : undefined;
}

export function videoEventParams(aspect: AspectMode, effect: SwapStyle): AnalyticsEventParams {
  return { aspect, effect, swap: effect };
}

/** gtag が無い（テスト・ブロック・未ロード）ときは何もしない。 */
export function trackEvent(name: AnalyticsEventName, params: AnalyticsEventParams): void {
  hostGtag()?.("event", name, params);
}

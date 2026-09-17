export const PREVIEW_PLAY_LABEL = "再生";
export const PREVIEW_PAUSE_LABEL = "一時停止";
export const PREVIEW_RESTART_LABEL = "最初から再生";

export function playPauseLabel(playing: boolean): string {
  return playing ? PREVIEW_PAUSE_LABEL : PREVIEW_PLAY_LABEL;
}

/** 最初から再生、またはクリップ末尾では 0 へシークする。一時停止からの再開は現在位置のまま。 */
export function shouldSeekPreviewToStart(input: {
  fromStart: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
}): boolean {
  if (input.fromStart || input.ended) return true;
  if (!(input.duration > 0)) return false;
  return input.currentTime >= input.duration - 0.05;
}

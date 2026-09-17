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

/**
 * 旧カウンタと同じタイミングで GA の video_preview を送る。
 * 開始時だけ。同じ再生中の再スタートは送らない。停止・完走では送らない。
 */
export function shouldTrackPreviewStart(input: {
  event: "start" | "stop" | "ended";
  recording: boolean;
  trackedThisPlayback: boolean;
}): boolean {
  return input.event === "start" && !input.recording && !input.trackedThisPlayback;
}

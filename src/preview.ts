export const PREVIEW_PLAY_LABEL = "再生";
export const PREVIEW_PAUSE_LABEL = "一時停止";
export const PREVIEW_RESTART_LABEL = "最初から再生";
export const PREVIEW_CLOSE_LABEL = "閉じる";

export type PreviewTransportState = {
  playDisabled: boolean;
  pauseDisabled: boolean;
  restartDisabled: boolean;
};

/** 再生と一時停止は別ボタン。再生中は再生を止め、止まっているときは一時停止を止める。 */
export function previewTransportState(input: {
  ready: boolean;
  recording: boolean;
  playing: boolean;
}): PreviewTransportState {
  const blocked = input.recording || !input.ready;
  return {
    playDisabled: blocked || input.playing,
    pauseDisabled: blocked || !input.playing,
    restartDisabled: blocked,
  };
}

export function previewStateLabel(input: { playing: boolean; pausedInSession: boolean }): string {
  if (input.playing) return "再生中";
  if (input.pausedInSession) return "一時停止中";
  return "停止中";
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

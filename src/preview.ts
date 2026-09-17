export const PREVIEW_PLAY_LABEL = "再生";
export const PREVIEW_PAUSE_LABEL = "一時停止";
export const PREVIEW_RESTART_LABEL = "最初から";
export const PREVIEW_SOUND_OFF_LABEL = "音声オフ";
export const PREVIEW_SOUND_ON_LABEL = "音声オン";
export const PREVIEW_MUTE_HINT = "プレビュー再生中の音声をミュートできます";
/** プレビュー再生の初期値。書き出し動画の音声には使わない。 */
export const PREVIEW_MUTED_DEFAULT = false;

const ICON_PLAY =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6.2 18.2 12 8 17.8Z" fill="currentColor"/></svg>';
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6.2h2.7v11.6H8Zm5.3 0H16v11.6h-2.7Z" fill="currentColor"/></svg>';
const ICON_RESTART =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 6.4v11.2M11 12 19.2 6.6v10.8Z" fill="currentColor"/></svg>';
const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 9.2h3.1L12.4 6v12l-4.5-3.2H4.8Z" fill="currentColor"/><path d="M15.4 9.1a3.5 3.5 0 0 1 0 5.8M17.7 6.8a6.2 6.2 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 9.2h3.1L12.4 6v12l-4.5-3.2H4.8Z" fill="currentColor"/><path d="M15.2 9.2 20 14.8M20 9.2l-4.8 5.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';

export function playPauseLabel(playing: boolean): string {
  return playing ? PREVIEW_PAUSE_LABEL : PREVIEW_PLAY_LABEL;
}

export function previewSoundLabel(muted: boolean): string {
  return muted ? PREVIEW_SOUND_OFF_LABEL : PREVIEW_SOUND_ON_LABEL;
}

export function playPauseButtonHtml(playing: boolean): string {
  return `${playing ? ICON_PAUSE : ICON_PLAY}<span class="preview-ctrl-label">${playPauseLabel(playing)}</span>`;
}

export function restartButtonHtml(): string {
  return `${ICON_RESTART}<span class="preview-ctrl-label">${PREVIEW_RESTART_LABEL}</span>`;
}

export function muteButtonHtml(muted: boolean): string {
  return `<span class="preview-ctrl-row">${muted ? ICON_SOUND_OFF : ICON_SOUND_ON}<span class="preview-ctrl-label">${previewSoundLabel(muted)}</span></span><small class="preview-mute-hint">${PREVIEW_MUTE_HINT}</small>`;
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

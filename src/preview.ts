import { DEFAULT_LOCALE, t, type Locale } from "./i18n.ts";
import { setTextIfChanged } from "./translate-guard.ts";

export const PREVIEW_PLAY_LABEL = t("ja", "previewPlay");
export const PREVIEW_PAUSE_LABEL = t("ja", "previewPause");
export const PREVIEW_RESTART_LABEL = t("ja", "previewRestart");
export const PREVIEW_SOUND_OFF_LABEL = t("ja", "previewSoundOff");
export const PREVIEW_SOUND_ON_LABEL = t("ja", "previewSoundOn");
export const PREVIEW_MUTE_HINT = t("ja", "previewMuteHint");
/** プレビュー再生の初期値。書き出し動画の音声には使わない。 */
export const PREVIEW_MUTED_DEFAULT = false;

const ICON_PLAY =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6.2 18.2 12 8 17.8Z" fill="currentColor"/></svg>';
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6.2h2.7v11.6H8Zm5.3 0H16v11.6h-2.7Z" fill="currentColor"/></svg>';
/** Lucide SkipBack。最初へ戻す（縦棒＋左向き三角）。 */
const ICON_RESTART =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 20 9 12 19 4Z" fill="currentColor"/><path d="M5 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 9.2h3.1L12.4 6v12l-4.5-3.2H4.8Z" fill="currentColor"/><path d="M15.4 9.1a3.5 3.5 0 0 1 0 5.8M17.7 6.8a6.2 6.2 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.8 9.2h3.1L12.4 6v12l-4.5-3.2H4.8Z" fill="currentColor"/><path d="M15.2 9.2 20 14.8M20 9.2l-4.8 5.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>';

export function playPauseLabel(playing: boolean, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, playing ? "previewPause" : "previewPlay");
}

export function previewSoundLabel(muted: boolean, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, muted ? "previewSoundOff" : "previewSoundOn");
}

function formatClockPart(value: number): string {
  const whole = Math.floor(Math.max(0, Number.isFinite(value) ? value : 0));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** シーク横の時間。小数は出さず、長さが分かるときは「現在 / 全体」。 */
export function formatPreviewClock(time: number, duration: number): string {
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const clamped = hasDuration ? Math.min(duration, Math.max(0, Number.isFinite(time) ? time : 0)) : time;
  const current = formatClockPart(clamped);
  if (!hasDuration) return current;
  return `${current} / ${formatClockPart(duration)}`;
}

function controlIcon(name: string, svg: string, visible: boolean): string {
  const hidden = visible ? "" : " hidden";
  return svg.replace("<svg ", `<svg class="preview-ctrl-icon" data-preview-icon="${name}"${hidden} `);
}

function volatileLabel(text: string): string {
  return `<span class="preview-ctrl-label notranslate" translate="no">${text}</span>`;
}

export function playPauseButtonHtml(playing: boolean, locale: Locale = DEFAULT_LOCALE): string {
  return `${controlIcon("play", ICON_PLAY, !playing)}${controlIcon("pause", ICON_PAUSE, playing)}${volatileLabel(playPauseLabel(playing, locale))}`;
}

export function restartButtonHtml(locale: Locale = DEFAULT_LOCALE): string {
  return `${ICON_RESTART}<span class="preview-ctrl-label">${t(locale, "previewRestart")}</span>`;
}

export function muteButtonHtml(muted: boolean, locale: Locale = DEFAULT_LOCALE): string {
  return `<span class="preview-ctrl-row">${controlIcon("sound-on", ICON_SOUND_ON, !muted)}${controlIcon("sound-off", ICON_SOUND_OFF, muted)}${volatileLabel(previewSoundLabel(muted, locale))}</span><small class="preview-mute-hint">${t(locale, "previewMuteHint")}</small>`;
}

export type PreviewControlRoot = {
  querySelector: (selector: string) => {
    toggleAttribute: (name: string, force?: boolean) => boolean;
    textContent?: string | null;
  } | null;
};

function showControlIcon(root: PreviewControlRoot, name: string, visible: boolean): void {
  root.querySelector(`[data-preview-icon="${name}"]`)?.toggleAttribute("hidden", !visible);
}

/** innerHTML を張り替えず、アイコンの hidden とラベル文字列だけ変える。 */
export function syncPlayPauseControl(
  root: PreviewControlRoot,
  playing: boolean,
  locale: Locale = DEFAULT_LOCALE,
): void {
  showControlIcon(root, "play", !playing);
  showControlIcon(root, "pause", playing);
  const label = root.querySelector(".preview-ctrl-label");
  if (label) setTextIfChanged(label, playPauseLabel(playing, locale));
}

export function syncMuteControl(
  root: PreviewControlRoot,
  muted: boolean,
  locale: Locale = DEFAULT_LOCALE,
): void {
  showControlIcon(root, "sound-on", !muted);
  showControlIcon(root, "sound-off", muted);
  const label = root.querySelector(".preview-ctrl-label");
  if (label) setTextIfChanged(label, previewSoundLabel(muted, locale));
}

/**
 * 中央ボタン以外をタップしたときの操作表示。
 * 止まっているときは隠さない。再生中だけ、出ていれば隠し、隠れていれば出す。
 */
export function previewSurfaceChromeAction(input: {
  chromeOpen: boolean;
  playing: boolean;
}): "show" | "hide" | "keep" {
  if (!input.chromeOpen) return "show";
  if (!input.playing) return "keep";
  return "hide";
}

/** プレビューが使えるのに止まっているときは、操作を出しておく。再生中の自動非表示は別経路。 */
export function shouldRevealPreviewChrome(input: {
  ready: boolean;
  playing: boolean;
  recording: boolean;
}): boolean {
  return input.ready && !input.playing && !input.recording;
}

/** スタジオのプレビューだけ末尾で先頭へ戻す。書き出し中はループしない。 */
export function shouldLoopPreviewPlayback(input: { recording: boolean; playing: boolean }): boolean {
  return input.playing && !input.recording;
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

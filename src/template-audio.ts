import { TEMPLATES, type AspectMode } from "./layout.ts";

/** 再生中にこれよりずれたら音声を映像の時刻へ戻す。 */
export const TEMPLATE_AUDIO_DRIFT_SEC = 0.08;

export function templateAudioIsSeparate(mode: AspectMode): boolean {
  return TEMPLATES[mode].audio !== TEMPLATES[mode].video;
}

/** 縦は映像ファイルの音声を出さない。横はプレビューのミュートだけ。 */
export function templatePictureMuted(mode: AspectMode, previewMuted: boolean): boolean {
  return templateAudioIsSeparate(mode) || previewMuted;
}

export function templateAudioNeedsSeek(audioTime: number, videoTime: number): boolean {
  return Number.isFinite(audioTime) && Number.isFinite(videoTime) && Math.abs(audioTime - videoTime) > TEMPLATE_AUDIO_DRIFT_SEC;
}

export type TemplateAudioFollow = {
  mode: AspectMode;
  previewMuted: boolean;
  picturePlaying: boolean;
  /** 書き出し中は別音声のデコーダを握ったままにしない。 */
  exporting: boolean;
  /** クリックなど、このターンがユーザージェスチャか。 */
  userGesture: boolean;
  /** 直前の play() が自動再生で拒否され、要素は止まったまま。 */
  playBlocked: boolean;
  /** play() の Promise がまだ終わっていない。 */
  playPending: boolean;
  /** timeupdate では false。再生ボタンとミュートだけ true。 */
  allowPlay: boolean;
  audioPaused: boolean;
  audioReady: boolean;
  audioTime: number;
  videoTime: number;
};

export type TemplateAudioPlan = {
  pictureMuted: boolean;
  audioMuted: boolean;
  /** 要素を止めて src を外し、パイプラインを返す。 */
  release: boolean;
  /** このターンで play() する。ミュートでも、メタデータ前でもよい。 */
  play: boolean;
  /** 映像の currentTime に合わせる。 */
  seek: boolean;
};

/**
 * 縦プレビューの別音声。play() はジェスチャか、拒否されていない再開だけ。
 * 書き出しと横画面は要素を手放し、WebKit の映像シークとデコーダを取り合わない。
 */
export function planTemplateAudio(state: TemplateAudioFollow): TemplateAudioPlan {
  const pictureMuted = templatePictureMuted(state.mode, state.previewMuted);
  const audioMuted = state.previewMuted;
  if (state.exporting || !templateAudioIsSeparate(state.mode)) {
    return { pictureMuted, audioMuted, release: true, play: false, seek: false };
  }
  const play =
    state.allowPlay &&
    state.picturePlaying &&
    (state.userGesture || (!state.playBlocked && state.audioPaused && !state.playPending));
  const seek =
    state.audioReady &&
    state.picturePlaying &&
    (play || state.userGesture || templateAudioNeedsSeek(state.audioTime, state.videoTime));
  return { pictureMuted, audioMuted, release: false, play, seek };
}

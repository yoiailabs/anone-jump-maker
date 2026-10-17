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

/**
 * 画角を変えて src を外すと映像の currentTime は 0 になる。
 * 再生を続けるときは、外す前に控えた時刻を音声の時計にする。0 も有効な時刻。
 */
export function templateAudioClock(videoTime: number, pinnedTime: number | null): number {
  return pinnedTime == null || !Number.isFinite(pinnedTime) ? videoTime : pinnedTime;
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
  /**
   * このターンで play() してよいか。
   * 再生・ミュート・画角・映像の play では true。timeupdate は止まった要素の再開だけに使い、
   * シークの理由にはしない。
   */
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
  // play やジェスチャだけではシークしない。currentTime の代入は再生中の play() を
  // WebKit が Abort し、その次の play() はジェスチャの外なので iOS では無音のままになる。
  // ずれているときだけ合わせる。play() がまだなら代入しない。
  const seek =
    state.audioReady &&
    state.picturePlaying &&
    !state.playPending &&
    templateAudioNeedsSeek(state.audioTime, state.videoTime);
  return { pictureMuted, audioMuted, release: false, play, seek };
}

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

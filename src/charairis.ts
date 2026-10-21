import track from "./generated/chara-iris-track.json";
import {
  characterDest, characterScale, characterShiftY, coverDest, DEFAULT_CHARACTER_SIZE,
  PHOTO_BASE_COLOR, TEMPLATE_FPS, type AspectMode, type CharacterSize,
} from "./layout.ts";

export type IrisCenter = { x: number; y: number };

/** テンプレのフレーム番号で参照。範囲外は端、欠測は直近の値（全欠測ならプレート中央）。 */
export function charaIrisPlateCenter(time: number, mode: AspectMode): IrisCenter {
  const points = track[mode];
  const frame = Number.isFinite(time) ? Math.floor(time * TEMPLATE_FPS + 1e-6) : 0;
  const sample = (index: number): number[] => {
    for (let i = Math.min(points.length - 1, Math.max(0, index)); i >= 0; i--) {
      const point = points[i];
      if (point && point.length === 2) return point;
    }
    return [0.5, 0.5];
  };
  const n = Math.max(0, Math.min(points.length - 1, frame));
  const before = sample(n - 1), current = sample(n), after = sample(n + 1);
  // ポーズ切替の1フレームの飛びを前後へ半分ずつ分散。ジャンプへの追従は残す。
  return { x: (before[0]! + 2 * current[0]! + after[0]!) / 4, y: (before[1]! + 2 * current[1]! + after[1]!) / 4 };
}

/** 実際にキー済みキャラを置く矩形を共用し、縦横・キャラ倍率・解像度を一致させる。 */
export function charaIrisCenter(
  time: number, w: number, h: number, mode: AspectMode, size: CharacterSize = DEFAULT_CHARACTER_SIZE,
): IrisCenter {
  const point = charaIrisPlateCenter(time, mode);
  const dest = characterDest(w, h, characterScale(mode, size), characterShiftY(h, mode), mode);
  return { x: dest.x + point.x * dest.w, y: dest.y + point.y * dest.h };
}

export function charaIrisRadius(progress: number, w: number, h: number, center: IrisCenter): number {
  const short = Math.min(w, h);
  const farthest = Math.hypot(Math.max(Math.abs(center.x), Math.abs(w - center.x)), Math.max(Math.abs(center.y), Math.abs(h - center.y)));
  // 白縁・AAを含む。最後の整数revealフレームでも縁を画面外へ送る。
  const end = farthest + short * 0.06;
  // 窓の進捗は7分割だが、最後の整数フレーム（S+3 = 6/7）で覆い切る。
  // 弱い二次のeaseOutでS-2〜S+2にも円弧を残し、後半まで隅へ動かす。
  const t = Math.max(0, Math.min(1, progress * 7 / 6));
  const eased = t + 0.12 * t * (1 - t);
  return short * 0.035 + (end - short * 0.035) * eased;
}

/** 写真は等倍coverのまま円でクリップ。白縁は写真フィルターの後段。 */
export function drawCharaIris(
  ctx: CanvasRenderingContext2D, bitmap: ImageBitmap | HTMLCanvasElement,
  w: number, h: number, progress: number, center: IrisCenter,
): void {
  const radius = charaIrisRadius(progress, w, h, center);
  const border = Math.min(w, h) * 0.011;
  const dest = coverDest(bitmap.width, bitmap.height, w, h);
  const path = new Path2D();
  path.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.save();
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = PHOTO_BASE_COLOR;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, dest.x, dest.y, dest.w, dest.h);
  ctx.restore();
  // 影のalpha=.001/.003は8bitで0.255/0.765。premultiplied色の丸めが
  // 作業面に依存し得る極小alphaの重ね描きを避け、不透明な白縁だけにする。
  // 白縁の中心・半径・太さは同じ。AA以外に半透明の帯を追加しない。
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = border;
  ctx.stroke(path);
  ctx.restore();
}

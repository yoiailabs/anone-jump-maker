import { coverDest } from "./layout.ts";

/** 中間サイズで一度だけ弾む。進捗は単調、半径だけが easeOutBack で行き過ぎて戻る。 */
export function easeOutBack(t: number): number {
  const u = t - 1;
  return 1 + 3.25 * u ** 3 + 2.25 * u ** 2;
}

export function catIrisRadius(progress: number, w: number, h: number): number {
  const short = Math.min(w, h);
  // 耳先〜あごの高さは短辺の60%。弾みの頂点でも約68%に収める。
  const middle = short * 0.60 / 2.35;
  const split = 4 / 7;
  if (progress <= split) return short * 0.035 + (middle - short * 0.035) * easeOutBack(Math.max(0, progress) / split);
  // 円の中心を下へ0.175ずらす分も見込み、白縁と影まで四隅の外へ送る。
  const end = (Math.hypot(w, h) / 2 + short * 0.15) / (1 - 0.175);
  const t = Math.min(1, (progress - split) / (1 - split));
  return middle + (end - middle) * t * t;
}

let silhouette: Path2D | undefined;
function catHead(): Path2D {
  if (silhouette) return silhouette;
  // 汎用の丸い頭と三角耳。既存キャラクターや画像からのトレースではない。
  const path = new Path2D();
  // 元の外接矩形は y=-1.35〜1。中央を原点に揃えて等方拡大する。
  const cy = 0.175;
  path.arc(0, cy, 1, -0.55, Math.PI + 0.55);
  path.lineTo(-0.85, -1.35 + cy);
  path.lineTo(-0.32, -0.95 + cy);
  path.quadraticCurveTo(0, -1.10 + cy, 0.32, -0.95 + cy);
  path.lineTo(0.85, -1.35 + cy);
  path.closePath();
  silhouette = path;
  return path;
}

/** 写真はフレームへ cover したまま、等方拡大したネコ形の穴だけに描く。画素読み戻しなし。 */
export function drawCatIris(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  w: number,
  h: number,
  progress: number,
): void {
  const radius = catIrisRadius(progress, w, h);
  const path = catHead();
  const border = Math.min(w, h) * 0.025;
  const dest = coverDest(bitmap.width, bitmap.height, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(radius, radius);
  ctx.save();
  ctx.clip(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bitmap, dest.x, dest.y, dest.w, dest.h);
  ctx.restore();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = border / radius;
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(30, 20, 35, 0.20)";
  ctx.shadowBlur = border * 0.45;
  ctx.shadowOffsetY = border * 0.15;
  ctx.stroke(path);
  ctx.restore();
}

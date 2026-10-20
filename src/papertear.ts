import { coverDest, type AspectMode } from "./layout.ts";

type TearPoint = { u: number; v: number; fiber: number };

/** カット番号から作る整数ハッシュ。再シーク・別解像度でも同じ紙の形にする。 */
function noise(cut: number, sample: number): number {
  let n = Math.imul(cut + 1, 0x9e3779b1) ^ Math.imul(sample + 17, 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

/** 長辺に沿う u と短辺方向の v。大きなうねりと細かなギザギザを重ねる。 */
export function paperTearSeam(cut: number, long: number, short: number): TearPoint[] {
  return Array.from({ length: 145 }, (_, i) => {
    const t = i / 144;
    const coarse = t * 8;
    const cell = Math.floor(coarse);
    const f = coarse - cell;
    const smooth = f * f * (3 - 2 * f);
    const wave = noise(cut, cell) * (1 - smooth) + noise(cut, cell + 1) * smooth - 0.5;
    return {
      u: (t * 1.12 - 0.06) * long,
      v: short * (0.5 + (t - 0.5) * (0.08 + noise(cut, 400) * 0.04)
        + wave * 0.10 + (noise(cut, i + 40) - 0.5) * 0.026),
      fiber: short * (0.006 + noise(cut, i + 200) * 0.009),
    };
  });
}

type TearPaths = { halves: Path2D[]; fibers: Path2D[] };
// サイズ変更や多数のカットでも際限なく保持しない。窓外は参照も構築もしない。
const paths = new Map<string, TearPaths>();

function tearPaths(cut: number, w: number, h: number, mode: AspectMode): TearPaths {
  const key = `${cut}:${w}:${h}:${mode}`;
  const cached = paths.get(key);
  if (cached) return cached;
  const horizontal = mode === "landscape";
  const long = horizontal ? w : h;
  const short = horizontal ? h : w;
  const seam = paperTearSeam(cut, long, short);
  const point = (path: Path2D, u: number, v: number, move = false) => {
    const x = horizontal ? u : v;
    const y = horizontal ? v : u;
    if (move) path.moveTo(x, y);
    else path.lineTo(x, y);
  };
  const halves: Path2D[] = [];
  const fibers: Path2D[] = [];
  for (const side of [-1, 1]) {
    const half = new Path2D();
    seam.forEach(({ u, v }, i) => point(half, u, v, i === 0));
    const outer = side < 0 ? -short * 0.06 : short * 1.06;
    point(half, seam.at(-1)!.u, outer);
    point(half, seam[0]!.u, outer);
    half.closePath();
    const fiber = new Path2D();
    // 紙の縁の細い突起もカットに固定し、フレームごとにちらつかせない。
    seam.forEach(({ u, v }, i) => point(fiber, u, v - side * (i % 5 === 0 ? short * 0.002 : 0), i === 0));
    for (let i = seam.length - 1; i >= 0; i--) {
      const { u, v, fiber: width } = seam[i]!;
      point(fiber, u, v + side * width);
    }
    fiber.closePath();
    halves.push(half);
    fibers.push(fiber);
  }
  const result = { halves, fibers };
  if (paths.size >= 96) paths.delete(paths.keys().next().value!);
  paths.set(key, result);
  return result;
}

/** 写真層だけを2Dで裂く。下の写真は等倍 cover、作業キャンバスや画素読み出しは不要。 */
export function drawPaperTear(
  ctx: CanvasRenderingContext2D,
  outgoing: ImageBitmap,
  incoming: ImageBitmap,
  w: number,
  h: number,
  mode: AspectMode,
  cut: number,
  progress: number,
): void {
  const next = coverDest(incoming.width, incoming.height, w, h);
  ctx.drawImage(incoming, next.x, next.y, next.w, next.h);
  const { halves, fibers } = tearPaths(cut, w, h, mode);
  const short = Math.min(w, h);
  const ease = Math.max(0, Math.min(1, progress)) ** 2;
  const distance = short * (0.0015 + 0.80 * ease);
  // 最初のフレームで外周に隙間が出ないよう、旧写真だけ0.8%オーバースキャンする。
  const old = coverDest(outgoing.width, outgoing.height, w, h, { scale: 1.008 });
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.translate(mode === "portrait" ? side * distance : 0, mode === "landscape" ? side * distance : 0);
    ctx.rotate(side * (2.8 + noise(cut, 500 + i) * 0.8) * Math.PI / 180 * ease);
    ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = "#fffdf7";
    ctx.shadowColor = "rgba(36, 24, 16, 0.16)";
    ctx.shadowBlur = short * 0.012;
    ctx.shadowOffsetY = short * 0.004;
    ctx.fill(fibers[i]!);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = ctx.shadowOffsetY = 0;
    ctx.save();
    ctx.clip(halves[i]!);
    ctx.drawImage(outgoing, old.x, old.y, old.w, old.h);
    ctx.restore();
    ctx.fill(fibers[i]!);
    ctx.restore();
  }
}

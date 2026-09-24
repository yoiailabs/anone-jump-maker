import { JUMP_CYCLE_FRAMES, JUMP_DROP_FRAC, jumpCycle } from "./layout.ts";

/**
 * トップの縦積みロゴ用。本編の 1 拍（15 フレ）と同じ割合で
 * 跳ね上がり（指数 2.3）と着地（二次曲線）を踏む。振幅だけ数ピクセルに抑える。
 * 後の拍ほど短く小さくして、2〜3 回で静かに止まる。
 */
export const HERO_LOGO_HOPS = [
  { amplitudePx: 9, durationMs: 360 },
  { amplitudePx: 4, durationMs: 280 },
  { amplitudePx: 1.5, durationMs: 200 },
] as const;

export const HERO_LOGO_HOP_ID = "hero-logo-hop";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function heroLogoHopDurationMs(hops: readonly { durationMs: number }[] = HERO_LOGO_HOPS): number {
  return hops.reduce((sum, hop) => sum + hop.durationMs, 0);
}

/**
 * 1 拍の中の位置 `progress`（0..1）での上方向のずれ（px、負が上）。
 * `jumpCycle` の dy を上下反転した形で、プレートの跳ね戻りと同じイージングになる。
 */
export function heroLogoHopDy(progress: number, amplitudePx: number): number {
  if (amplitudePx === 0) return 0;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const lift = 1 - jumpCycle(clamped * JUMP_CYCLE_FRAMES).dy / JUMP_DROP_FRAC;
  const dy = -amplitudePx * lift;
  return dy === 0 ? 0 : dy;
}

function translateY(px: number): string {
  const rounded = Math.round(px * 100) / 100;
  const value = rounded === 0 ? 0 : rounded;
  return `translateY(${value}px)`;
}

export function heroLogoHopFrames(
  hops: readonly { amplitudePx: number; durationMs: number }[] = HERO_LOGO_HOPS,
): Keyframe[] {
  const total = heroLogoHopDurationMs(hops);
  let elapsed = 0;
  const frames: Keyframe[] = [];
  hops.forEach((hop, hopIndex) => {
    for (let sample = 0; sample <= JUMP_CYCLE_FRAMES; sample += 1) {
      if (hopIndex > 0 && sample === 0) continue;
      const local = sample / JUMP_CYCLE_FRAMES;
      const offset = total === 0 ? 0 : (elapsed + local * hop.durationMs) / total;
      frames.push({
        offset,
        transform: translateY(heroLogoHopDy(local, hop.amplitudePx)),
      });
    }
    elapsed += hop.durationMs;
  });
  return frames;
}

type HopTarget = {
  animate: (keyframes: Keyframe[], options?: KeyframeAnimationOptions) => Animation;
};

export function prefersReducedMotion(win: Pick<Window, "matchMedia">): boolean {
  return win.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** ロゴが準備できたあと一度だけ再生する。動きを減らす設定では再生しない。 */
export function playHeroLogoHop(logo: HopTarget, win: Pick<Window, "matchMedia"> = window): Animation | null {
  if (prefersReducedMotion(win)) return null;
  return logo.animate(heroLogoHopFrames(), {
    duration: heroLogoHopDurationMs(),
    easing: "linear",
    fill: "none",
    iterations: 1,
    id: HERO_LOGO_HOP_ID,
  });
}

type HopLogo = HTMLImageElement & HopTarget;

/** デコード後、最初の描画を見せてから跳ねる。戻り値でキャンセルする。 */
export function scheduleHeroLogoHop(logo: HopLogo, win: Window = window): () => void {
  if (prefersReducedMotion(win)) return () => {};
  let cancelled = false;
  let animation: Animation | null = null;
  const start = () => {
    if (cancelled) return;
    animation = playHeroLogoHop(logo, win);
  };
  const decoded = typeof logo.decode === "function" ? logo.decode() : Promise.resolve();
  void decoded
    .then(() => {
      if (cancelled) return;
      win.requestAnimationFrame(() => {
        win.requestAnimationFrame(start);
      });
    })
    .catch(() => {
      if (cancelled) return;
      win.requestAnimationFrame(start);
    });
  return () => {
    cancelled = true;
    animation?.cancel();
  };
}

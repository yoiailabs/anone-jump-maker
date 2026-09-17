export type AspectMode = "portrait" | "landscape";

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 縦はテンプレ miWuv4NK9Qk と同じ 608×1080。横は 1280×720（プレビュー＝保存）。 */
export const OUTPUTS = {
  portrait: { width: 608, height: 1080 },
  landscape: { width: 1280, height: 720 },
} as const;

/** 新テンプレ miWuv4NK9Qk / 参考 Short と同じ 608×1080。 */
export const OUTPUT = OUTPUTS.portrait;

export const TEMPLATES = {
  portrait: { video: "/template/vertical.mp4", cuts: "/template/cuts.json" },
  landscape: { video: "/template/landscape.mp4", cuts: "/template/landscape-cuts.json" },
} as const;

/** テンプレ緑 16:9 帯（実測 312–654、高さ 342 = 608×9/16）。 */
export const TEMPLATE_BAND_Y = 312;
export const TEMPLATE_BAND_H = 342;

export const MAIN_PANEL_Y_FRAC = TEMPLATE_BAND_Y / OUTPUT.height;

/**
 * 参考 Short（30fps・608×1080）の本編 16:9 写真 hop。
 * キャラを塗って潰した写真に ECC 並進＋特徴点をかけ、同一写真ショット末（静止）基準で測った。
 * きれいな区間のピークはおおよそ 30–44px、中央値 ≈ 34px。予備の 7–15px はカット混入。
 */
export const JUMP_AMPLITUDE = 34 / OUTPUT.height;

/** 1 ジャンプの長さ（秒）。実測 13 フレ @30fps。スロット間隔より長くはしない。 */
export const JUMP_DURATION = 13 / 30;

/** 頂点の位置（duration 比）。実測は 6–7 フレ目 ≈ 半分。短い滞空は正弦ローブで出す。 */
export const JUMP_PEAK_U = 0.5;

/**
 * 参考横動画（cola_rumiren0 / anim-ref.mp4、30fps）の切替実測。
 * カットの 1 フレ前から白フラッシュが立ち上がり、切替フレームはほぼ白飛び
 * （例: t=1.967 で L≈202・std≈2.6）。新写真はフラッシュの中で現れ、
 * 続く 2–3 フレでパンチズーム＋横ズレ＋弱い色分れが落ち、hop に続く。
 */
export const SWAP_PRE_ROLL = 1 / 30;
export const SWAP_DURATION = 0.1;
export const SWAP_FLASH_PEAK = 0.92;
export const SWAP_PUNCH = 0.18;
export const SWAP_SLIDE_FRAC = 0.016;
export const SWAP_CHROMA_FRAC = 0.007;
export const SWAP_SKEW = 0.04;

/** 横専用。参考 Short（hagikaze_sami）は hop なし・短い放射ズームワープ。 */
export type SwapStyle = "jump" | "zoom";

export const SWAP_STYLES = ["jump", "zoom"] as const;

export const SWAP_STYLE_LABELS: Record<SwapStyle, string> = {
  jump: "ジャンプ",
  zoom: "ズーム",
};

/**
 * 参考横（hagikaze_sami）のズーム切り。2–5 フレ（≈0.05–0.15s）。
 * ズームアウト（寄った新写真から引く）。放射ブラー＋横ストリーク＋ RGB ずれ。
 * 長い白フラッシュは使わない。
 */
export const ZOOM_PRE_ROLL = 1 / 30;
export const ZOOM_DURATION = 3 / 30;
export const ZOOM_PUNCH = 0.14;
export const ZOOM_FLASH_PEAK = 0;
export const ZOOM_BLUR_PEAK = 1;
export const ZOOM_CHROMA_FRAC = 0.016;
export const ZOOM_WHIP_PEAK = 0.85;
export const ZOOM_WAVE_PEAK = 0.5;
export const ZOOM_SMEAR_PEAK = 0.62;
/** ズームアウトの伸び／縮み幅。出ていく側は 1/(1+grow)、入ってくる側は 1+grow。 */
export const ZOOM_GROW = 0.92;

export type SwapFx = {
  /** 0–1。窓の外は 0。 */
  amount: number;
  /** 白フラッシュ 0–1。カットで最大。ズームではごく弱いハイライト。 */
  flash: number;
  /** cover 倍率（静止時 1。ジャンプは >1、ズームアウトは <1）。 */
  punch: number;
  /** パネル幅に対する横ズレ（符号つき）。 */
  slide: number;
  /** 色分れの強さ 0–1。 */
  chroma: number;
  /** せん断。 */
  skew: number;
  /** 放射ズームブラー 0–1。ジャンプでは 0。 */
  zoomBlur: number;
  /** 0=出ていく写真、1=入ってくる写真。 */
  mix: number;
  /** 横方向のモーションストリーク 0–1。 */
  whip: number;
  /** 波打ち／リキッド歪み 0–1。 */
  wave: number;
  /** 切替瞬間のキャラスミア 0–1。 */
  smear: number;
  /** この窓が向かうスロット。無効時は 0。 */
  cutIndex: number;
};

const SWAP_NONE: SwapFx = {
  amount: 0,
  flash: 0,
  punch: 1,
  slide: 0,
  chroma: 0,
  skew: 0,
  zoomBlur: 0,
  mix: 1,
  whip: 0,
  wave: 0,
  smear: 0,
  cutIndex: 0,
};

export function isSwapStyle(value: string): value is SwapStyle {
  return value === "jump" || value === "zoom";
}

/** 縦は常にジャンプ。横だけ UI の選択を使う。 */
export function effectiveSwapStyle(mode: AspectMode, style: SwapStyle = "jump"): SwapStyle {
  return mode === "landscape" ? style : "jump";
}

/**
 * 本編 16:9 をキャンバスへ cover する倍率。
 * 1 で本編上端→キャンバス上端、本編下端→キャンバス下端（参考と同じ）。
 */
export const BLUR_COVER_SCALE = 1;

/** 参考は本編上端の 1px 暗線。 */
export const PANEL_DIVIDER_PX = 1;

/** 上下帯の暗転。参考 Short の帯は本編の約 0.33–0.40 輝度。 */
export const BLUR_DIM = "rgba(4, 3, 3, 0.62)";

/**
 * 参考 Short の本編キャラ。緑帯 1:1 より大きく、下辺揃えで拡大する。
 * 参考 16:9 とテンプレ緑帯の実測（0.13 / 0.50 / 1.00 / 5.00s）から。
 */
export const CHAR_SCALE = 1.7;

/**
 * 縦だけ、下揃えのあとさらに下へずらす（本編 342px での px）。
 * 1.7 倍のまま足元を揃えると頭が本編上端に寄り、cover ブラー帯の背景キャラも高い。
 * 参考 Short の 16:9 にテンプレ線画を重ねると、約 +80px で頭・足元が重なる。
 */
export const CHAR_SHIFT_Y = 80;

/**
 * 横の公式例（全面 16:9）に合わせた拡大。
 * 縦の 1.7 を横全面にそのまま使うとキャラがフレームを埋めすぎる。
 */
export const LANDSCAPE_CHAR_SCALE = 1.35;

/** 公式のステッカー縁（白、縦本編 608px 幅でのピクセル）。 */
export const CHAR_OUTLINE_PX = 2;

export const BLUR_SOURCE = "main-frame" as const;

export function isAspectMode(value: string): value is AspectMode {
  return value === "portrait" || value === "landscape";
}

export function usesBlurBackdrop(mode: AspectMode): boolean {
  return mode === "portrait";
}

export function characterScale(mode: AspectMode = "portrait"): number {
  return mode === "landscape" ? LANDSCAPE_CHAR_SCALE : CHAR_SCALE;
}

/** 縦本編の追加下げ。横は 0。パネル高さに比例させる。 */
export function characterShiftY(panelH: number, mode: AspectMode = "portrait"): number {
  if (mode === "landscape") return 0;
  return CHAR_SHIFT_Y * (panelH / TEMPLATE_BAND_H);
}

/** キー済み緑帯を本編 16:9 へ置く矩形。下揃え・左右中央。`shiftY` でさらに下へ。 */
export function characterDest(panelW: number, panelH: number, scale = CHAR_SCALE, shiftY = 0): Rect {
  const w = panelW * scale;
  const h = panelH * scale;
  return {
    x: (panelW - w) / 2,
    y: panelH - h + shiftY,
    w,
    h,
  };
}

/** 本編幅に合わせてステッカー縁を太らせる。縦 608 では 2px のまま。 */
export function characterOutlinePx(panelW: number): number {
  return Math.max(CHAR_OUTLINE_PX, Math.round((CHAR_OUTLINE_PX * panelW) / OUTPUT.width));
}

export function outputSize(mode: AspectMode = "portrait"): { width: number; height: number } {
  return OUTPUTS[mode];
}

/** 縦: 中央のシャープな 16:9。横: キャンバス全体が本編。 */
export function mainPanelRect(canvasW: number, canvasH: number, mode: AspectMode = "portrait"): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: canvasW, h: canvasH };
  }
  const w = canvasW;
  const h = canvasW * (TEMPLATE_BAND_H / OUTPUT.width);
  const y = canvasH * (TEMPLATE_BAND_Y / OUTPUT.height);
  return { x: 0, y: Math.round(y), w, h: Math.round(h) };
}

/** テンプレ映像から切り出す矩形。縦は緑 16:9 帯、横は全面。 */
export function templateBandRect(videoW: number, videoH: number, mode: AspectMode = "portrait"): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: videoW, h: videoH };
  }
  return {
    x: 0,
    y: Math.round(videoH * (TEMPLATE_BAND_Y / OUTPUT.height)),
    w: videoW,
    h: Math.round(videoW * (TEMPLATE_BAND_H / OUTPUT.width)),
  };
}

/** 本編パネル内の写真が hop しても端が見えないだけの cover 倍率。 */
export function sharpCoverScale(canvasH: number, panelH: number): number {
  const hop = canvasH * JUMP_AMPLITUDE;
  return 1 + (2 * hop) / Math.max(panelH, 1);
}

export function coverDest(
  srcW: number,
  srcH: number,
  destW: number,
  destH: number,
  options: { scale?: number; offsetY?: number; dx?: number; dy?: number } = {},
): Rect {
  const scale = Math.max(destW / Math.max(srcW, 1e-6), destH / Math.max(srcH, 1e-6)) * (options.scale ?? 1);
  const w = srcW * scale;
  const h = srcH * scale;
  return {
    x: (options.dx ?? 0) + (destW - w) / 2,
    y: (options.dy ?? 0) + (destH - h) / 2 + (options.offsetY ?? 0),
    w,
    h,
  };
}

/** Canvas2D（左上原点）の矩形 → WebGL UV（左下原点）。 */
export function rectToUvBottomLeft(rect: Rect, canvasW: number, canvasH: number): [number, number, number, number] {
  return [rect.x / canvasW, 1 - (rect.y + rect.h) / canvasH, rect.w / canvasW, rect.h / canvasH];
}

/**
 * カット開始から hop 曲線。0 = 静止、1 = 頂点。
 * `cuts.json` のスロット＝テンプレのポーズ切替に同期する。
 */
export function jumpAmount(time: number, slots: readonly number[]): number {
  if (slots.length === 0) return 0;
  let start = slots[0]!;
  let next = slots[1] ?? start + JUMP_DURATION;
  for (let i = 1; i < slots.length; i += 1) {
    const t = slots[i]!;
    if (time + 1e-4 >= t) {
      start = t;
      next = slots[i + 1] ?? start + JUMP_DURATION;
    } else {
      break;
    }
  }
  const duration = Math.min(JUMP_DURATION, Math.max(0.2, next - start));
  const u = (time - start) / duration;
  if (u <= 0 || u >= 1) return 0;
  // 実測エンベロープは対称に近い（6–7 フレで頂点、2 フレほど丸い滞空、6–7 フレで着地）。
  // 旧 0.34/0.66 の sin→cos は立ち上がりが約 4 フレと速すぎた。
  return Math.sin(Math.PI * u);
}

/** 上方向が負（Canvas2D）。本編 16:9 内の写真 hop に使う。ズーム切りでは 0。 */
export function jumpOffsetPx(
  time: number,
  slots: readonly number[],
  canvasHeight: number,
  style: SwapStyle = "jump",
): number {
  if (style === "zoom") return 0;
  const amount = jumpAmount(time, slots);
  if (amount === 0) return 0;
  return -amount * canvasHeight * JUMP_AMPLITUDE;
}

function slotStartAt(time: number, slots: readonly number[], lookahead: number): { start: number; index: number } {
  let start = slots[0]!;
  let index = 0;
  for (let i = 1; i < slots.length; i += 1) {
    const t = slots[i]!;
    if (time + lookahead + 1e-4 >= t) {
      start = t;
      index = i;
    } else {
      break;
    }
  }
  return { start, index };
}

/**
 * カット前後の写真切替エンベロープ。先頭スロットは「切替」ではないので無効。
 * ジャンプはフラッシュ＋パンチ。ズームは短い放射ワープ（白飛びなし、ズームアウト）。
 */
export function swapFx(time: number, slots: readonly number[], style: SwapStyle = "jump"): SwapFx {
  if (slots.length < 2) return SWAP_NONE;
  const preRoll = style === "zoom" ? ZOOM_PRE_ROLL : SWAP_PRE_ROLL;
  const duration = style === "zoom" ? ZOOM_DURATION : SWAP_DURATION;
  const { start, index } = slotStartAt(time, slots, preRoll);
  if (index === 0) return SWAP_NONE;
  const span = preRoll + duration;
  const tau = time - (start - preRoll);
  if (tau < 0 || tau >= span) return SWAP_NONE;
  const u = tau / span;
  const uPeak = preRoll / span;
  const flashEnv = u <= uPeak ? u / Math.max(uPeak, 1e-6) : 1 - (u - uPeak) / Math.max(1 - uPeak, 1e-6);
  const env = clamp01(flashEnv);
  const amount = env ** 0.65;
  const dir = index % 2 === 0 ? 1 : -1;
  if (style === "zoom") {
    return {
      amount,
      flash: 0,
      punch: 1 - ZOOM_PUNCH * amount,
      slide: 0,
      chroma: amount,
      skew: 0,
      zoomBlur: env ** 0.4 * ZOOM_BLUR_PEAK,
      mix: smoothstep(uPeak * 0.2, 0.78, u),
      whip: env ** 0.45 * ZOOM_WHIP_PEAK,
      wave: env ** 0.75 * ZOOM_WAVE_PEAK,
      smear: env ** 0.55 * ZOOM_SMEAR_PEAK,
      cutIndex: index,
    };
  }
  return {
    amount,
    flash: env ** 0.85 * SWAP_FLASH_PEAK,
    punch: 1 + SWAP_PUNCH * amount,
    slide: dir * SWAP_SLIDE_FRAC * amount,
    chroma: amount * amount,
    skew: dir * SWAP_SKEW * amount,
    zoomBlur: 0,
    mix: 1,
    whip: 0,
    wave: 0,
    smear: 0,
    cutIndex: index,
  };
}

export function swapSlidePx(fx: SwapFx, panelW: number): number {
  return fx.slide * panelW;
}

export function swapChromaPx(fx: SwapFx, panelW: number): number {
  const frac = fx.zoomBlur > 0 ? ZOOM_CHROMA_FRAC : SWAP_CHROMA_FRAC;
  return fx.chroma * frac * panelW;
}

/**
 * 参考横（hagikaze_sami）のズームアウト。
 * 出ていく写真は中心へ縮み、入ってくる写真は寄った状態から 1 へ引く。
 */
export function zoomPlateScales(fx: SwapFx): { outgoing: number; incoming: number } {
  const blur = fx.zoomBlur;
  return {
    outgoing: 1 / (1 + ZOOM_GROW * blur),
    incoming: 1 + ZOOM_GROW * blur * (1 - fx.mix),
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

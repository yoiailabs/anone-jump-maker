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

/**
 * `.stage` の max-width（styles.css と揃える）。
 * 縦 21rem / 横 26rem。クレジットの画面上の大きさはこの比で換算する。
 */
export const STAGE_MAX_REM = {
  portrait: 21,
  landscape: 26,
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
 * テンプレは 30fps。切替エフェクトはフレーム単位で実測しているので、この値で時間→フレームに直す。
 * スロット時刻 S（cuts.json）は色分け Short utNIG60-li0 の色切替＝テンプレのポーズ切替フレーム。
 * ジャンプは S に新写真、ズームは S+1 に新写真（S はブラー頂点）。
 */
export const TEMPLATE_FPS = 30;

/**
 * 切替エフェクトの系統。縦・横どちらでも選べる（2×2 の組み合わせ）。
 * - jump: 参考 Short（o1ROhNU0UNw）。写真がカットへ向かって沈み、カットで白フラッシュ＋跳ね戻る。
 * - zoom: 参考投稿（hagikaze_sami）。出ていく写真が中心へ縮み、横ブラー＋RGB ずれで抜け、新写真が寄りから引く。
 */
export type SwapStyle = "jump" | "zoom";

export const SWAP_STYLES = ["jump", "zoom"] as const;

export const SWAP_STYLE_LABELS: Record<SwapStyle, string> = {
  jump: "ジャンプ",
  zoom: "ズーム",
};

export const ASPECT_LABELS: Record<AspectMode, string> = {
  portrait: "縦",
  landscape: "横",
};

export function isSwapStyle(value: string): value is SwapStyle {
  return value === "jump" || value === "zoom";
}

/**
 * 写真層フィルター。向き・切替と独立に選べる。線画キャラには掛けない。
 * - none: 加工なし
 * - blur-strong / blur-weak: 差し込み写真だけにボケ感
 */
export type ImageFilter = "none" | "blur-strong" | "blur-weak";

export const IMAGE_FILTERS = ["none", "blur-weak", "blur-strong"] as const;

export const IMAGE_FILTER_LABELS: Record<ImageFilter, string> = {
  none: "なし",
  "blur-strong": "ブラー(強)",
  "blur-weak": "ブラー(弱)",
};

export function isImageFilter(value: string): value is ImageFilter {
  return value === "none" || value === "blur-strong" || value === "blur-weak";
}

/**
 * 本編パネル長辺に対するブラー半径。弱はうっすらベール、強はその一段上。
 * プレビューと保存で同じ関数を使う。iOS では画素ぼかしで再現する。
 */
export const FILTER_BLUR_FRAC: Record<ImageFilter, number> = {
  none: 0,
  "blur-weak": 0.005,
  "blur-strong": 0.011,
};

export function filterBlurPx(filter: ImageFilter, shortSide: number): number {
  const frac = FILTER_BLUR_FRAC[filter];
  if (frac <= 0) return 0;
  return Math.max(2, Math.round(shortSide * frac));
}

export function hasImageFilter(filter: ImageFilter): boolean {
  return filterBlurPx(filter, 100) > 0;
}

/*
 * ───────────── ジャンプ系（参考 Short o1ROhNU0UNw、30fps）─────────────
 * 本編 16:9 の写真を SIFT + RANSAC で同一ショットの静止フレーム（カット +7）に合わせて実測。
 * 8 カットでほぼ同じ値が出た（px は参考 360×640 の帯 203px 高に対する値）。
 *
 *   k(カットからのフレーム)  0     1     2     3     4     5     6     7 |  8    9    10   11   12   13   14
 *   dy(px, +が下)           35.4  24.4  15.9  9.7   5.1   2.1   0.5   0  | 0.3  1.5  4.9  8.6  13.7 19.7 27.0
 *   scale                   .947  .961  .972  .981  .989  .995  .998  1  | .999 .997 .995 .988 .981 .972 .960
 *
 * つまり新写真は「下にずれて少し小さい」状態で現れ、7 フレで元の位置へ跳ね戻り、
 * そこから次のカット（15 フレ＝1 拍）へ向かって二次曲線で再び沈む。1 クリップ＝1 サイクルで、
 * スロットが 14 フレなら沈み切る前に次のカットが来る。
 */

/** 1 サイクル（1 拍）のフレーム数。 */
export const JUMP_CYCLE_FRAMES = 15;

/** カットから元の位置へ戻るまでのフレーム数。 */
export const JUMP_RISE_FRAMES = 7;

/** カット瞬間の下ずれ（本編パネル高さに対する比）。35.4 / 202.7。 */
export const JUMP_DROP_FRAC = 0.175;

/** カット瞬間の縮み。1 − 0.947。 */
export const JUMP_SHRINK = 0.053;

/** 戻りのイージング指数。位置は (1−k/7)^2.3、倍率は (1−k/7)^2 が実測に乗る。 */
export const JUMP_RISE_POW = 2.3;
export const JUMP_RISE_SCALE_POW = 2;

/**
 * カット直後の白フラッシュ。カットの前には無い（−3..−1 フレは輝度マッピングが恒等）。
 * 写真層のみ（キャラの黒線はほぼ黒のまま）。位置合わせした画素マッピングは
 * k=0: 45→150 / 75→175 / 105→200 / 135→220、k=1: 約 +45、k=2: 約 +15、k=3: 0。
 * 加算 0.30 ＋スクリーン 0.20 を (1−k/3)^2 で減衰させると乗る。
 */
export const JUMP_FLASH_FRAMES = 3;
export const JUMP_FLASH_ADD = 0.3;
export const JUMP_FLASH_SCREEN = 0.2;
/** キャラを含む全面にごく薄く乗る白（黒線が 0→約 14 に上がる分）。 */
export const JUMP_FLASH_GLOBAL = 0.06;

/**
 * 参考ではカット瞬間（下ずれ 17.5%・縮み 5.3%）でも本編上端まで写真が詰まっている。
 * 写真を大きめに cover し、静止位置を少し上に寄せて、沈んでも隙間が出ないようにする。
 *   上余白（カット時）= (0.947×1.32 − 1)/2 + 0.07 − 0.175 ≈ 0.02 ≥ 0
 *   下余白（静止時）  = (1.32 − 1)/2 − 0.07 = 0.09 ≥ 0
 */
export const JUMP_COVER_SCALE = 1.32;
export const JUMP_REST_SHIFT_FRAC = -0.07;

/*
 * ───────────── ズーム系（参考投稿 hagikaze_sami、1280×720・30fps）─────────────
 * τ = テンプレのポーズ切替フレーム S からのフレーム数。写真の倍率（キャラは拡縮されない）:
 *
 *   τ      −2     −1     0    | +1     +2     +3    +4
 *   scale  .988   .947   .866 | 1.115  1.025  1.004  1
 *
 * 出ていく写真は S まで表示され（S でポーズは新、写真は旧）、新写真は S+1 から。
 * 全面（写真＋キャラ）に横方向のモーションブラー・RGB 横ずれ・明度リフトが乗る:
 *   横ブラー長   −1: ≈10px  0: ≈35px  +1: ≈18px      （幅 1280 比 0.008 / 0.027 / 0.014）
 *   RGB ずれ     −1: ≈2px   0: ≈8px   +1: ≈5px       （R が右・B が左）
 *   明度         −1: +12    0: 中間調 +90（std 保持＝加算）  +1: 0.7L+30（灰 100 へ 25%）
 *   波打ち       0 で数 px（幅の 0.4% 程度）。
 */

/** 縮みは S−3 から S へ。1 − 0.134·((τ+3)/3)^2.25 が −2/−1/0 の実測 .988/.947/.866 に乗る。 */
export const ZOOM_OUT_FRAMES = 3;
export const ZOOM_OUT_SHRINK = 0.134;
export const ZOOM_OUT_POW = 2.25;

/** 新写真は S+1 で 1.115、以後 1 フレごとに (s−1) が 0.2 倍。 */
export const ZOOM_IN_START = 0.115;
export const ZOOM_IN_DECAY = 0.2;
export const ZOOM_SWAP_DELAY_FRAMES = 1;

/** τ をキーにした全面 FX。間は線形補間、外は 0。値はパネル幅に対する比か 0–1。 */
export type ZoomKey = { blur: number; rgb: number; lift: number; haze: number; wave: number };

export const ZOOM_KEYS: ReadonlyArray<readonly [tau: number, key: ZoomKey]> = [
  [-2, { blur: 0, rgb: 0, lift: 0, haze: 0, wave: 0 }],
  [-1, { blur: 0.008, rgb: 0.002, lift: 0.05, haze: 0, wave: 0.0015 }],
  [0, { blur: 0.027, rgb: 0.0065, lift: 0.35, haze: 0, wave: 0.004 }],
  [1, { blur: 0.014, rgb: 0.004, lift: 0, haze: 0.25, wave: 0.0015 }],
  [2, { blur: 0.002, rgb: 0.0005, lift: 0, haze: 0.08, wave: 0 }],
  [3, { blur: 0, rgb: 0, lift: 0, haze: 0, wave: 0 }],
];

/** 縮んだ出ていく写真の後ろに敷く、同じ写真の cover ぼかし（黒帯を見せない）。幅比。 */
export const ZOOM_BACKDROP_BLUR_FRAC = 0.02;

export type SwapFx = {
  /** 表示する写真のスロット。ズームは S+1 まで前の写真が残る。 */
  plateSlot: number;
  /** 写真の倍率（基準 cover に対して。静止時 1）。 */
  scale: number;
  /** 写真の縦ずれ（パネル高さ比、+ が下）。 */
  dy: number;
  /** 写真層に乗せる白の加算量 0–1（ジャンプ）。 */
  flashAdd: number;
  /** 写真層に乗せる白のスクリーン量 0–1（ジャンプ）。 */
  flashScreen: number;
  /** 全面に乗せる薄い白 0–1（ジャンプ）。 */
  flashGlobal: number;
  /** 全面の横モーションブラー長（パネル幅比）。 */
  blur: number;
  /** 全面の RGB 横ずれ（パネル幅比、R が +・B が −）。 */
  rgb: number;
  /** 全面の白加算 0–1（ズーム頂点）。 */
  lift: number;
  /** 全面の灰かぶり 0–1（ズーム直後）。 */
  haze: number;
  /** 行ごとの横波打ち振幅（パネル幅比）。 */
  wave: number;
  /** 縮んだ写真の後ろに cover ぼかしを敷くか。 */
  backdrop: boolean;
  /** この窓が属するカット（スロット境界）。先頭スロット内で切替が無ければ 0。 */
  cutIndex: number;
};

const NO_FX = {
  flashAdd: 0,
  flashScreen: 0,
  flashGlobal: 0,
  blur: 0,
  rgb: 0,
  lift: 0,
  haze: 0,
  wave: 0,
  backdrop: false,
} as const;

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

/** 写真を本編パネルへ cover する基準倍率。ジャンプは沈んでも端が見えないよう大きめ、ズームは等倍。 */
export function plateCoverScale(style: SwapStyle): number {
  return style === "jump" ? JUMP_COVER_SCALE : 1;
}

/** 静止位置の縦ずれ（パネル高さ比）。ジャンプは上寄せ、ズームは中央。 */
export function plateRestShiftFrac(style: SwapStyle): number {
  return style === "jump" ? JUMP_REST_SHIFT_FRAC : 0;
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

/** フレーム境界の比較に使う許容（フレーム単位）。時刻の丸めで 0.99999 になった 1 フレを 1 とみなす。 */
const FRAME_EPS = 1e-6;

/** `time` が属するスロット（先頭は 0）とその開始時刻。`slotForTime` と同じ 1e-4 の許容。 */
function slotAt(time: number, slots: readonly number[]): { start: number; index: number } {
  let start = slots[0] ?? 0;
  let index = 0;
  for (let i = 1; i < slots.length; i += 1) {
    const t = slots[i]!;
    if (time + 1e-4 >= t) {
      start = t;
      index = i;
    } else {
      break;
    }
  }
  return { start, index };
}

/**
 * ジャンプ系の写真の位置と倍率。k = カットからのフレーム（小数可）。
 * 0..7 で跳ね戻り、7..15 で二次曲線で沈む。15 以降（長いスロット）は沈み切った位置で待つ。
 * 先頭スロットもテンプレ開始をカットとして同じサイクルを踏む（参考 Short は 0 秒からこの動き）。
 */
export function jumpCycle(k: number): { scale: number; dy: number } {
  if (k < 0) return { scale: 1, dy: 0 };
  if (k < JUMP_RISE_FRAMES - FRAME_EPS) {
    const r = 1 - k / JUMP_RISE_FRAMES;
    return {
      scale: 1 - JUMP_SHRINK * r ** JUMP_RISE_SCALE_POW,
      dy: JUMP_DROP_FRAC * r ** JUMP_RISE_POW,
    };
  }
  const v = clamp01((k - JUMP_RISE_FRAMES) / (JUMP_CYCLE_FRAMES - JUMP_RISE_FRAMES));
  if (v < FRAME_EPS) return { scale: 1, dy: 0 };
  return {
    scale: 1 - JUMP_SHRINK * v * v,
    dy: JUMP_DROP_FRAC * v * v,
  };
}

/** ジャンプ系のフラッシュ包絡。k=0 で 1、(1−k/3)^2 で 3 フレ後に 0。 */
export function jumpFlashEnvelope(k: number): number {
  if (k < 0 || k >= JUMP_FLASH_FRAMES - FRAME_EPS) return 0;
  const r = 1 - k / JUMP_FLASH_FRAMES;
  return r * r;
}

/** ズーム系の出ていく写真の倍率。τ = S からのフレーム（−3..0 で縮む、0..1 は縮み切った値で待つ）。 */
export function zoomOutScale(tau: number): number {
  if (tau <= -ZOOM_OUT_FRAMES) return 1;
  const u = clamp01((tau + ZOOM_OUT_FRAMES) / ZOOM_OUT_FRAMES);
  return 1 - ZOOM_OUT_SHRINK * u ** ZOOM_OUT_POW;
}

/** ズーム系の入ってくる写真の倍率。τ=1 で 1.115、以後 1 フレごとに 0.2 倍で 1 へ。 */
export function zoomInScale(tau: number): number {
  if (tau < ZOOM_SWAP_DELAY_FRAMES) return 1 + ZOOM_IN_START;
  const grow = ZOOM_IN_START * ZOOM_IN_DECAY ** (tau - ZOOM_SWAP_DELAY_FRAMES);
  return grow < 1e-4 ? 1 : 1 + grow;
}

/** ZOOM_KEYS を τ で線形補間。範囲外は 0。 */
export function zoomKeyAt(tau: number): ZoomKey {
  const zero: ZoomKey = { blur: 0, rgb: 0, lift: 0, haze: 0, wave: 0 };
  const first = ZOOM_KEYS[0]!;
  const last = ZOOM_KEYS[ZOOM_KEYS.length - 1]!;
  if (tau <= first[0] || tau >= last[0]) return zero;
  for (let i = 1; i < ZOOM_KEYS.length; i += 1) {
    const [t0, a] = ZOOM_KEYS[i - 1]!;
    const [t1, b] = ZOOM_KEYS[i]!;
    if (tau <= t1) {
      const u = (tau - t0) / Math.max(t1 - t0, 1e-6);
      return {
        blur: a.blur + (b.blur - a.blur) * u,
        rgb: a.rgb + (b.rgb - a.rgb) * u,
        lift: a.lift + (b.lift - a.lift) * u,
        haze: a.haze + (b.haze - a.haze) * u,
        wave: a.wave + (b.wave - a.wave) * u,
      };
    }
  }
  return zero;
}

/**
 * 時刻 `time` の写真表示と切替 FX。プレビューと保存は同じこの値で描く。
 * - jump: 表示スロット＝現在スロット。カットから 1 サイクル（15 フレ）の沈み／跳ね戻りとフラッシュ。
 * - zoom: S..S+1 は前のスロットの写真が縮んだまま残り、S+1 から新写真が寄りから引く。
 *   前後 2〜3 フレは全面に横ブラー・RGB ずれ・明度リフト／灰かぶり。
 */
export function swapFx(time: number, slots: readonly number[], style: SwapStyle = "jump"): SwapFx {
  if (slots.length === 0) {
    return { ...NO_FX, plateSlot: 0, scale: 1, dy: 0, cutIndex: 0 };
  }
  const { start, index } = slotAt(time, slots);
  const k = (time - start) * TEMPLATE_FPS;

  if (style === "jump") {
    // 参考 Short は 0 秒の先頭スロットも同じサイクル＋フラッシュで始まる。
    const motion = jumpCycle(k);
    const env = jumpFlashEnvelope(k);
    return {
      ...NO_FX,
      plateSlot: index,
      scale: motion.scale,
      dy: motion.dy,
      flashAdd: JUMP_FLASH_ADD * env,
      flashScreen: JUMP_FLASH_SCREEN * env,
      flashGlobal: JUMP_FLASH_GLOBAL * env,
      cutIndex: index,
    };
  }

  // zoom: 直前のカット S=start に対して τ=k、次のカットに対して τ=k−len。
  const next = slots[index + 1];
  const untilNext = next === undefined ? Number.POSITIVE_INFINITY : (next - time) * TEMPLATE_FPS;
  if (index > 0 && k < ZOOM_SWAP_DELAY_FRAMES - FRAME_EPS) {
    // S..S+1: 前の写真が縮み切ったまま残る（ポーズだけ新）。
    const key = zoomKeyAt(k);
    return {
      ...key,
      plateSlot: index - 1,
      scale: zoomOutScale(0),
      dy: 0,
      flashAdd: 0,
      flashScreen: 0,
      flashGlobal: 0,
      backdrop: true,
      cutIndex: index,
    };
  }
  if (next !== undefined && untilNext <= ZOOM_OUT_FRAMES + FRAME_EPS) {
    // 次のカットへ向かって縮む。
    const tau = -untilNext;
    const key = zoomKeyAt(tau);
    const scale = zoomOutScale(tau);
    return {
      ...key,
      plateSlot: index,
      scale,
      dy: 0,
      flashAdd: 0,
      flashScreen: 0,
      flashGlobal: 0,
      backdrop: scale < 0.999,
      cutIndex: index + 1,
    };
  }
  if (index > 0) {
    // S+1 以降: 新写真が寄りから引く。
    const key = zoomKeyAt(k);
    return {
      ...key,
      plateSlot: index,
      scale: zoomInScale(k),
      dy: 0,
      flashAdd: 0,
      flashScreen: 0,
      flashGlobal: 0,
      backdrop: false,
      cutIndex: index,
    };
  }
  return { ...NO_FX, plateSlot: 0, scale: 1, dy: 0, cutIndex: 0 };
}

/** 切替 FX が何か描画に影響するか（全面 FX の作業キャンバスを省くため）。 */
export function hasFrameFx(fx: SwapFx): boolean {
  return fx.blur > 1e-4 || fx.rgb > 1e-5 || fx.lift > 1e-3 || fx.haze > 1e-3 || fx.wave > 1e-5;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export type AspectMode = "portrait" | "landscape";

/** X 投稿でよく使う横を先に出し、初期選択にする。 */
export const DEFAULT_ASPECT: AspectMode = "landscape";
export const ASPECT_MODES: readonly AspectMode[] = ["landscape", "portrait"];

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** 縦は 1080×1920（Shorts）、横は 1920×1080。保存はこのサイズ。 */
export const OUTPUTS = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
} as const;

/**
 * 縦プレートの縦横比と線画位置の基準。インク 138–431 と緑帯 342 はこの 608×1080 で測った。
 * 書き出しは 1080×1920。クロマの画素も音声も landscape.mp4。
 */
export const PORTRAIT_TEMPLATE = { width: 608, height: 1080 } as const;

/** 縦キャラのクロマ源フレーム。landscape.mp4 そのもの。 */
export const PORTRAIT_CHROMA_FRAME = { width: 1920, height: 1080 } as const;

/**
 * `.stage` の max-width（styles.css と揃える）。
 * 縦 21rem / 横 26rem。クレジットの画面上の大きさはこの比で換算する。
 */
export const STAGE_MAX_REM = {
  portrait: 21,
  landscape: 26,
} as const;

/** 縦出力の既定サイズ。写真はこのキャンバス全面に cover する。 */
export const OUTPUT = OUTPUTS.portrait;

export const TEMPLATES = {
  portrait: {
    video: "/official-assets/template/landscape.mp4",
    audio: "/official-assets/template/landscape.mp4",
    cuts: "/official-assets/template/landscape-cuts.json",
  },
  landscape: {
    video: "/official-assets/template/landscape.mp4",
    audio: "/official-assets/template/landscape.mp4",
    cuts: "/official-assets/template/landscape-cuts.json",
  },
} as const;

/** 縦テンプレの緑 16:9 帯（実測 312–654、高さ 342 = 608×9/16）。キャラのクロマ源で、写真の枠ではない。 */
export const TEMPLATE_BAND_Y = 312;
export const TEMPLATE_BAND_H = 342;

/** 帯の上端 1px は暗い罫、その下が混色なので、キーするとき上を 2px 切る。 */
export const TEMPLATE_BAND_TOP_CROP = 2;

/** 写真パネルは縦横ともキャンバス上端から全面。 */
export const MAIN_PANEL_Y_FRAC = 0;

/**
 * 緑帯の中の線画（クロマ抜き後）。左右は frame 270（t=9s）。
 * 下端は帯の最終行（band 内 y=341、inclusive）。470 フレーム中 452 で、
 * 幅 8% 以上の非緑ランがここで終わる。細いインクだけの 18 フレームは帯端より上で切れるが、基準は変えない。
 * 右・下は画素の外縁（exclusive）。下端比は上端 2px を切った帯の中で、帯端までなので 1。
 */
export const PORTRAIT_INK_X0 = 138 / PORTRAIT_TEMPLATE.width;
export const PORTRAIT_INK_X1 = 431 / PORTRAIT_TEMPLATE.width;
export const PORTRAIT_INK_BOTTOM_ROW = TEMPLATE_BAND_H - 1;
export const PORTRAIT_INK_BOTTOM =
  (PORTRAIT_INK_BOTTOM_ROW + 1 - TEMPLATE_BAND_TOP_CROP) / (TEMPLATE_BAND_H - TEMPLATE_BAND_TOP_CROP);

/**
 * 新縦テンプレ utNIG60-li0 の t=9s ステッカー（白縁込み）。
 * x 9.3%–81.1%（幅 71.8%、中心 45.2%）、下端 75.8%。上端はポーズで動く。
 */
export const PORTRAIT_STICKER_LEFT = 0.093;
export const PORTRAIT_STICKER_RIGHT = 0.811;
export const PORTRAIT_STICKER_BOTTOM = 0.758;

/**
 * テンプレは 30fps。切替エフェクトはフレーム単位で実測しているので、この値で時間→フレームに直す。
 * スロット時刻 S（landscape-cuts.json。縦横共通）は色分け Short utNIG60-li0 の色切替＝テンプレのポーズ切替フレーム。
 * ジャンプ・グリッチは S に新写真、ズームは縦横とも S+1 に新写真（S はブラー頂点）。
 */
export const TEMPLATE_FPS = 30;

/**
 * 切替エフェクトの系統。縦・横どちらでも選べる。
 * - jump: 参考 Short（o1ROhNU0UNw）。写真がカットへ向かって沈み、カットで白フラッシュ＋跳ね戻る。
 * - zoom: 参考投稿（hagikaze_sami）。出ていく写真が中心へ縮み、横ブラー＋RGB ずれで抜け、新写真が寄りから引く。
 * - glitch: カット前後だけ RGB・横スライス・ブロックがずれ、カットでは新写真をクリーンに出す。
 */
export type SwapStyle = "jump" | "zoom" | "glitch";

/** 設定の並び。ズームを先頭（左）にし、初期選択もズーム。 */
export const SWAP_STYLES = ["zoom", "jump", "glitch"] as const;

export const DEFAULT_SWAP_STYLE: SwapStyle = SWAP_STYLES[0];

export const SWAP_STYLE_LABELS: Record<SwapStyle, string> = {
  jump: "ジャンプ",
  zoom: "ズーム",
  glitch: "グリッチ",
};

export const ASPECT_LABELS: Record<AspectMode, string> = {
  portrait: "縦",
  landscape: "横",
};

export function isSwapStyle(value: string): value is SwapStyle {
  return value === "jump" || value === "zoom" || value === "glitch";
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
 * 線画キャラの大きさ。向き・切替・フィルターと独立。
 * キー済み 16:9 プレートの倍率。標準は各向きの基準配置（縦は新テンプレのステッカー、横はフレーム等倍）。
 */
export type CharacterSize = "standard" | "1.2" | "1.4";

export const CHARACTER_SIZES = ["standard", "1.2", "1.4"] as const;

export const DEFAULT_CHARACTER_SIZE: CharacterSize = "standard";

export const CHARACTER_SIZE_LABELS: Record<CharacterSize, string> = {
  standard: "標準",
  "1.2": "1.2",
  "1.4": "1.4",
};

export const CHARACTER_SIZE_SCALE: Record<CharacterSize, number> = {
  standard: 1,
  "1.2": 1.2,
  "1.4": 1.4,
};

export function isCharacterSize(value: string): value is CharacterSize {
  return (CHARACTER_SIZES as readonly string[]).includes(value);
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

/** カット瞬間の下ずれ（本編パネル高さに対する比）。35.4 / 202.7。横はこの実測のまま。 */
export const JUMP_DROP_FRAC = 0.175;

/**
 * 向きごとのジャンプ縦振幅（パネル高さ比）。
 *
 * 見えの揺れは、視聴者から見たフレームの短辺に対する移動で揃える。
 * 実測 `JUMP_DROP_FRAC` は横のフレーム高さに対する比で、横の短辺は高さそのもの。
 * だからピーク移動 / 短辺 = 0.175。縦の短辺は幅なので、同じ比を高さ比へ直す。
 *
 *   dy = JUMP_DROP_FRAC × (shorterSide / frameHeight)
 *
 * 横: shorterSide = height → dy = 0.175。ピークは 1080×0.175 = 189px。
 * 縦: shorterSide / frameHeight = width / height = 1080/1920 = 9/16。
 *     dy = 0.175 × 1080/1920 = 0.0984375。ピークは 1080×0.175 = 189px
 *     （高さの 9.84%。同じ 0.175 のままだと 336px で、縦長フレームでは大きく見える）。
 *
 * カバー 1.32 と上寄せ 0.07 は、横の 17.5% 沈みでも端が出ない余白
 * （カット時の上 ≈ 2%）を前提にしている。縦の dy はそれより小さいので、
 * 被写体はその安全域の内側に残る。縮み（JUMP_SHRINK）は変えない。
 */
export function jumpDropFrac(mode: AspectMode = "landscape"): number {
  const { width, height } = OUTPUTS[mode];
  return JUMP_DROP_FRAC * (Math.min(width, height) / height);
}

/** 縦のカット瞬間の下ずれ。`jumpDropFrac("portrait")`。 */
export const JUMP_DROP_FRAC_PORTRAIT = jumpDropFrac("portrait");

/** カット瞬間の縮み。1 − 0.947。 */
export const JUMP_SHRINK = 0.053;

/** 戻りのイージング指数。位置は (1−k/7)^2.3、倍率は (1−k/7)^2 が実測に乗る。 */
export const JUMP_RISE_POW = 2.3;
export const JUMP_RISE_SCALE_POW = 2;

/**
 * カット前 3 フレから立ち上がり、カット後 4 フレで消える白フラッシュ。
 * 前側は u² のイーズイン、後側は r² で減衰し、カット瞬間の加算 0.30 ＋スクリーン 0.20 は維持する。
 * 写真層のみ（キャラの黒線はほぼ黒のまま）。ピークは実測の画素マッピング
 * 45→150 / 75→175 / 105→200 / 135→220 を基準にしている。
 */
export const JUMP_FLASH_IN_FRAMES = 3;
export const JUMP_FLASH_FRAMES = 4;
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
 * ───────────── ズーム系（参考投稿 hagikaze_sami、16:9・30fps。実測は 1280×720）─────────────
 * τ = テンプレのポーズ切替フレーム S からのフレーム数。写真の倍率（キャラは拡縮されない）:
 *
 *   τ      −2     −1     0    | +1     +2     +3    +4
 *   scale  .988   .947   .866 | 1.115  1.025  1.004  1
 *
 * 出ていく写真は S まで表示され（S でポーズは新、写真は旧）、新写真は S+1 から。
 * このカーブは横の実測。縦は同じ値を、カットからの時間だけ zoomTransitionScale 倍に引き伸ばす。
 * 振幅（縮み 0.866、寄り 1.115）は向きで変えない。写真の入れ替わりも S+1 を同じ倍率で遅らせる。
 * 全面（写真＋キャラ）に横方向のモーションブラー・RGB 横ずれ・明度リフトが乗る:
 *   横ブラー長   −1: ≈10px  0: ≈35px  +1: ≈18px      （実測幅 1280 比 0.008 / 0.027 / 0.014。書き出し幅でもこの比）
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

/**
 * 上下の縁の移動を、フレームの短辺で割った速さ（倍率 1 あたり。共通の 1/2 は省く）。
 *
 * 見えの速さは短辺に対する移動で揃える。倍率の変化 ds で上下の縁は高さの ds/2 動く。
 * 横の短辺は高さそのものなので、縁 / 短辺 = 1。
 * 縦の短辺は幅。同じ ds でも上下の縁は背の高さ分動き、狭い幅で割ると大きく見える。
 *
 *   speed = frameHeight / shorterSide
 */
export function zoomEdgeTravelOverShortSide(mode: AspectMode): number {
  const { width, height } = OUTPUTS[mode];
  return height / Math.min(width, height);
}

/**
 * 縦ズームの時間倍率。横の実測カーブを 1 とする。形と振幅は同じで、カットからの時間だけ割る。
 *
 * 短辺に対する縁の速さは `zoomEdgeTravelOverShortSide`。横は 1、縦は 1920/1080 ≈ 1.778。
 * その倍率はプレビューで長く感じたので、1 と 1.778 のほぼ中間へ知覚調整する。
 * 算術平均は (1 + 1920/1080) / 2 ≈ 1.39、幾何平均は sqrt(1920/1080) ≈ 1.33。ここは 1.4。
 * 最短カットは 13 フレ。1.4 倍でも縮み 3 フレ＋FX の尾 τ=+3 は 8.4 フレで、隣のカットに被らない。
 */
export const ZOOM_PORTRAIT_TIME_SCALE = 1.4;

export function zoomTransitionScale(mode: AspectMode = "landscape"): number {
  if (mode !== "portrait") return 1;
  return ZOOM_PORTRAIT_TIME_SCALE;
}

/** カットからの実フレームを、横の実測カーブ上の τ に写す。τ=0 はカットのまま。 */
export function zoomReferenceTau(framesFromCut: number, mode: AspectMode = "landscape"): number {
  return framesFromCut / zoomTransitionScale(mode);
}

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
  /** 縮んだ写真の外側を、プレートの縁で鏡映した写真で埋めるか。 */
  backdrop: boolean;
  /** この窓が属するカット（スロット境界）。先頭スロット内で切替が無ければ 0。 */
  cutIndex: number;
  /** グリッチ専用。旧エフェクトの値は変えず、必要なフレームだけ作る。 */
  glitch?: { amount: number; frame: number };
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

const GLITCH_BEFORE_FRAMES = 5;
const GLITCH_AFTER_FRAMES = 4;
/** 前 5 枚で強まり、カットの 1 枚を空けて後 4 枚で減衰する。 */
const GLITCH_AMOUNTS = [0.2, 0.4, 0.6, 0.8, 1, 0, 0.45, 0.3, 0.18, 0.08] as const;
/** 明滅の強さと期間は延長前のまま。スライスや RGB の量から切り離す。 */
const GLITCH_FLASH_BEFORE_FRAMES = 3;
const GLITCH_FLASH_AMOUNTS = [0.35, 0.65, 1, 0, 0.35, 0.2, 0.1] as const;

/**
 * キャラ倍率の基準。横は公式 16:9 フレーム等倍。
 * 縦の基準位置は `characterDest` が utNIG60-li0 に合わせ、この値は 1 のままサイズ倍率に掛ける。
 */
export const CHAR_SCALE = 1;

/** 公式は追加の縦ずれなし。残しているのは characterDest の shiftY 用。 */
export const CHAR_SHIFT_Y = 0;

/** 横も公式 16:9 と同じ等倍。 */
export const LANDSCAPE_CHAR_SCALE = 1;

/** 公式のステッカー縁（白）。テンプレ幅 608px で 2px。書き出し幅では比例して太る。 */
export const CHAR_OUTLINE_PX = 2;

export const BLUR_SOURCE = "main-frame" as const;

export function isAspectMode(value: string): value is AspectMode {
  return (ASPECT_MODES as readonly string[]).includes(value);
}

/** 縦横とも写真がキャンバス全面。ぼかし背景・暗転・仕切り線は使わない。 */
export function usesBlurBackdrop(_mode: AspectMode): boolean {
  return false;
}

export function characterPlateScale(size: CharacterSize = DEFAULT_CHARACTER_SIZE): number {
  return CHARACTER_SIZE_SCALE[size];
}

export function characterScale(
  mode: AspectMode = "portrait",
  size: CharacterSize = DEFAULT_CHARACTER_SIZE,
): number {
  const base = mode === "landscape" ? LANDSCAPE_CHAR_SCALE : CHAR_SCALE;
  return base * characterPlateScale(size);
}

/** 公式は縦横とも 0。`CHAR_SHIFT_Y` を変えたときだけパネル高さに比例させる。 */
export function characterShiftY(panelH: number, mode: AspectMode = "portrait"): number {
  if (mode === "landscape" || CHAR_SHIFT_Y === 0) return 0;
  return CHAR_SHIFT_Y * (panelH / TEMPLATE_BAND_H);
}

/** 縦プレートの水平カット。素材内の下端比は固定なので、画素を読まずにこの高さで切る。 */
export function portraitCutY(dest: { y: number; h: number }): number {
  return dest.y + PORTRAIT_INK_BOTTOM * dest.h;
}

/**
 * キー済み 16:9 プレートをキャンバスへ置く矩形。
 * 横はフレーム等倍（拡大時は下端中央を固定）。
 * 縦は緑帯プレートを utNIG60-li0 のステッカー位置へ。左右の白縁はプレートの外にはみ出すので、
 * インクをその分だけ内側に置く。水平カットは縁の太さではずらさず、キャンバス高の 75.8% に置く。
 * 拡大してもカットと中心 x は動かない。下方向の白縁は合成側でカットより下を描かない。
 */
export function characterDest(
  canvasW: number,
  canvasH: number,
  scale = CHAR_SCALE,
  shiftY = 0,
  mode: AspectMode = canvasW < canvasH ? "portrait" : "landscape",
): Rect {
  if (mode !== "portrait") {
    const w = canvasW * scale;
    const h = canvasH * scale;
    return {
      x: (canvasW - w) / 2,
      y: canvasH - h + shiftY,
      w,
      h,
    };
  }
  const outline = characterOutlinePx(canvasW);
  const inkLeft = PORTRAIT_STICKER_LEFT * canvasW + outline;
  const inkRight = PORTRAIT_STICKER_RIGHT * canvasW - outline;
  const inkBottom = PORTRAIT_STICKER_BOTTOM * canvasH;
  const inkWFrac = PORTRAIT_INK_X1 - PORTRAIT_INK_X0;
  const inkCxFrac = (PORTRAIT_INK_X0 + PORTRAIT_INK_X1) / 2;
  const plateW = ((inkRight - inkLeft) / inkWFrac) * scale;
  const bandH = TEMPLATE_BAND_H - TEMPLATE_BAND_TOP_CROP;
  const plateH = plateW * (bandH / PORTRAIT_TEMPLATE.width);
  const anchorX = ((PORTRAIT_STICKER_LEFT + PORTRAIT_STICKER_RIGHT) / 2) * canvasW;
  return {
    x: anchorX - inkCxFrac * plateW,
    y: inkBottom - PORTRAIT_INK_BOTTOM * plateH + shiftY,
    w: plateW,
    h: plateH,
  };
}

/** 本編幅に合わせてステッカー縁を太らせる。テンプレ幅 608 で 2px、縦 1080 では 4px、横 1920 では 6px。 */
export function characterOutlinePx(panelW: number): number {
  return Math.max(CHAR_OUTLINE_PX, Math.round((CHAR_OUTLINE_PX * panelW) / PORTRAIT_TEMPLATE.width));
}

export function outputSize(mode: AspectMode = "portrait"): { width: number; height: number } {
  return OUTPUTS[mode];
}

/** 写真を cover する範囲。縦横ともキャンバス全面（ぼかし帯はない）。 */
export function mainPanelRect(canvasW: number, canvasH: number, _mode: AspectMode = "portrait"): Rect {
  return { x: 0, y: 0, w: canvasW, h: canvasH };
}

/**
 * 縦キャラを landscape フレームから切る上端。608 幅の 2px クロップは 1920 幅で 6px。
 * 帯の高さ 340 は 1074px。6+1074 でフレーム下端に着く。
 * 縦動画の帯位置（y = 312/1080）をこのフレームに使うと y=318, h=1074 で 312px はみ出す。
 */
const PORTRAIT_CHROMA_SCALE = PORTRAIT_CHROMA_FRAME.width / PORTRAIT_TEMPLATE.width;
export const PORTRAIT_CHROMA_Y = Math.round(TEMPLATE_BAND_TOP_CROP * PORTRAIT_CHROMA_SCALE);
export const PORTRAIT_CHROMA_H = Math.round((TEMPLATE_BAND_H - TEMPLATE_BAND_TOP_CROP) * PORTRAIT_CHROMA_SCALE);

/** テンプレ映像から切り出す矩形。縦は landscape フレームの y=6, h=1074。横は全面。 */
export function templateBandRect(videoW: number, videoH: number, mode: AspectMode = "portrait"): Rect {
  if (mode === "landscape") {
    return { x: 0, y: 0, w: videoW, h: videoH };
  }
  const sx = videoW / PORTRAIT_CHROMA_FRAME.width;
  const sy = videoH / PORTRAIT_CHROMA_FRAME.height;
  const y = Math.min(Math.round(PORTRAIT_CHROMA_Y * sy), Math.max(0, videoH - 1));
  const h = Math.max(1, Math.min(Math.round(PORTRAIT_CHROMA_H * sy), videoH - y));
  const w = Math.max(1, Math.min(videoW, Math.round(PORTRAIT_CHROMA_FRAME.width * sx)));
  return { x: 0, y, w, h };
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

const SLOT_TIME_EPS = 1e-4;

/** `time` が属するスロット（先頭は 0）とその開始時刻。`slotForTime` と同じ 1e-4 の許容。 */
function slotAt(time: number, slots: readonly number[]): { start: number; index: number } {
  let start = slots[0] ?? 0;
  let index = 0;
  for (let i = 1; i < slots.length; i += 1) {
    const t = slots[i]!;
    if (time + SLOT_TIME_EPS >= t) {
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
 * 縦振幅だけ向きで変える（縦は JUMP_DROP_FRAC_PORTRAIT）。縮みのカーブは共通。
 */
export function jumpCycle(k: number, mode: AspectMode = "landscape"): { scale: number; dy: number } {
  const drop = jumpDropFrac(mode);
  if (k < 0) return { scale: 1, dy: 0 };
  if (k < JUMP_RISE_FRAMES - FRAME_EPS) {
    const r = 1 - k / JUMP_RISE_FRAMES;
    return {
      scale: 1 - JUMP_SHRINK * r ** JUMP_RISE_SCALE_POW,
      dy: drop * r ** JUMP_RISE_POW,
    };
  }
  const v = clamp01((k - JUMP_RISE_FRAMES) / (JUMP_CYCLE_FRAMES - JUMP_RISE_FRAMES));
  if (v < FRAME_EPS) return { scale: 1, dy: 0 };
  return {
    scale: 1 - JUMP_SHRINK * v * v,
    dy: drop * v * v,
  };
}

/** ジャンプ系のフラッシュ包絡。前 3 フレで立ち上がり、k=0 で 1、後 4 フレで 0。前側は u²、後側は r²。 */
export function jumpFlashEnvelope(k: number): number {
  const u = k < 0 ? clamp01((k + JUMP_FLASH_IN_FRAMES) / JUMP_FLASH_IN_FRAMES) : clamp01(1 - k / JUMP_FLASH_FRAMES);
  return u * u;
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
 * - jump: 表示スロット＝現在スロット。カットから 1 サイクル（15 フレ）の沈み／跳ね戻り。フラッシュはカット前 3／後 4 フレ。
 *   縦の下ずれは jumpDropFrac（短辺比を高さ比に直した値）。横は実測の JUMP_DROP_FRAC。
 * - zoom: S..S+1 は前のスロットの写真が縮んだまま残り、S+1 から新写真が寄りから引く。
 *   横は前後 2〜3 フレ。縦はカットからの時間を ZOOM_PORTRAIT_TIME_SCALE で割り、横と同じカーブを引く。
 *   全面に横ブラー・RGB ずれ・明度リフト／灰かぶり。
 * - glitch: 写真は S に即時切替。前 5 フレで強まるデジタルずれ、S の 1 枚はクリーン、後 4 フレは弱い余韻。
 *   プレビューと保存は同じ compositor.draw からここを呼ぶ。
 */
export function swapFx(
  time: number,
  slots: readonly number[],
  style: SwapStyle = "jump",
  mode: AspectMode = "landscape",
): SwapFx {
  if (slots.length === 0) {
    return { ...NO_FX, plateSlot: 0, scale: 1, dy: 0, cutIndex: 0 };
  }
  const { start, index } = slotAt(time, slots);
  const k = (time - start) * TEMPLATE_FPS;

  if (style === "jump") {
    // 参考 Short は 0 秒の先頭スロットも同じサイクル＋フラッシュで始まる。
    const motion = jumpCycle(k, mode);
    // 次の実在するカットだけ先行発光する。短い間隔では減衰と立ち上がりの大きい方を使う。
    const next = slots[index + 1];
    const upcoming = next === undefined ? 0 : jumpFlashEnvelope((time - next) * TEMPLATE_FPS);
    const env = Math.max(jumpFlashEnvelope(k), upcoming);
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

  if (style === "glitch") {
    // 写真を選んだ slotAt と同じ境界 time + SLOT_TIME_EPS >= S を使う。
    // 丸めた S=1.966667 と保存時刻 59/30 でも、写真と FX は共にカット後の frame 0。
    // 任意のプレビュー時刻でも、この境界から 1 フレーム分は常にクリーン。
    const frameAt = (cut: number) => Math.floor((time + SLOT_TIME_EPS - cut) * TEMPLATE_FPS);
    let cutIndex = index;
    let frame = Math.max(0, frameAt(start));
    const next = slots[index + 1];
    if (next !== undefined) {
      // 符号は同じスロット判定から導く（境界上の浮動小数の誤差にも対応）。
      const nextFrame = Math.min(-1, frameAt(next));
      // 窓が重なるほど短い間隔でも、写真初出の frame 0 は必ず空け、以後は次のカットを優先する。
      if (nextFrame >= -GLITCH_BEFORE_FRAMES && (index === 0 || frame > 0)) {
        cutIndex = index + 1;
        frame = nextFrame;
      }
    }
    // 先頭には写真の切替がないのでグリッチを出さない。
    const inWindow = cutIndex > 0 && frame >= -GLITCH_BEFORE_FRAMES && frame <= GLITCH_AFTER_FRAMES;
    const amount = inWindow ? GLITCH_AMOUNTS[frame + GLITCH_BEFORE_FRAMES] ?? 0 : 0;
    const flashAmount = cutIndex > 0 ? GLITCH_FLASH_AMOUNTS[frame + GLITCH_FLASH_BEFORE_FRAMES] ?? 0 : 0;
    const env = flashAmount * jumpFlashEnvelope(frame);
    return {
      ...NO_FX,
      plateSlot: index,
      scale: 1,
      dy: 0,
      cutIndex,
      flashAdd: 0.06 * env,
      flashScreen: 0.03 * env,
      ...(amount > 0 ? { glitch: { amount, frame } } : {}),
    };
  }

  // zoom: 横の実測 τ をそのまま使う。縦はカットからの実フレームを ZOOM_PORTRAIT_TIME_SCALE で割ってから、
  // 同じ分岐（縮み・S+1 の写真入れ替わり・寄り）に入れる。振幅は分岐の中で変わらない。
  const next = slots[index + 1];
  const untilNext = next === undefined ? Number.POSITIVE_INFINITY : (next - time) * TEMPLATE_FPS;
  const kRef = zoomReferenceTau(k, mode);
  const untilNextRef = zoomReferenceTau(untilNext, mode);
  if (index > 0 && kRef < ZOOM_SWAP_DELAY_FRAMES - FRAME_EPS) {
    // S..S+1（縦はその時間を ZOOM_PORTRAIT_TIME_SCALE 倍）: 前の写真が縮み切ったまま残る。
    const key = zoomKeyAt(kRef);
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
  if (next !== undefined && untilNextRef <= ZOOM_OUT_FRAMES + FRAME_EPS) {
    // 次のカットへ向かって縮む。横は 3 フレ、縦は 3×ZOOM_PORTRAIT_TIME_SCALE フレ。
    const tau = -untilNextRef;
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
    // S+1 以降: 新写真が寄りから引く。縦はこの減衰も同じ倍率で遅い。
    const key = zoomKeyAt(kRef);
    return {
      ...key,
      plateSlot: index,
      scale: zoomInScale(kRef),
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
  return fx.blur > 1e-4 || fx.rgb > 1e-5 || fx.lift > 1e-3 || fx.haze > 1e-3 || fx.wave > 1e-5 || (fx.glitch?.amount ?? 0) > 0;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

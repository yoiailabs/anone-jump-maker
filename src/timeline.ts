export type CutTimeline = {
  duration: number;
  /** 各スロットの開始秒（frame/fps）。 */
  slots: number[];
  fps?: number;
  /** `slots` と同じ拍のテンプレフレーム番号（参考用）。 */
  slotFrames?: number[];
  /** 参照ショートの色数。再生枚数の指定には使わない。 */
  photoCount?: number;
  /** 参照ショートで各スロットに入っていた色番号（0..9）。再生順には使わない。 */
  slotPhotoOrder?: number[];
};

/** compositor に渡す最小限。写真は渡した配列の順で出す。 */
export type SlotTimeline = Pick<CutTimeline, "slots">;

/**
 * 参考テンプレ（色分け動画 utNIG60-li0）の色順。32 カットに 10 色が
 *   A B C D E F G B E A H B A I F I B D H I G H J C H F I J G D A I
 * と並ぶ。A..J → 0..9。計測の記録であり、再生順には使わない。
 */
export const TEMPLATE_PHOTO_COUNT = 10;
export const TEMPLATE_SLOT_PHOTO_ORDER: readonly number[] = [
  0, 1, 2, 3, 4, 5, 6, 1, 4, 0, 7, 1, 0, 8, 5, 8, 1, 3, 7, 8, 6, 7, 9, 2, 7, 5, 8, 9, 6, 3, 0, 8,
];

export function slotForTime(time: number, slots: readonly number[]): number {
  if (slots.length === 0) return 0;
  let index = 0;
  for (let i = 1; i < slots.length; i += 1) {
    if (time + 1e-4 >= slots[i]!) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}

/**
 * スロット → 写真番号。選んだ順のまま出す（先頭が最初のカット）。
 * カット数より枚数が少ないときは、同じ順で先頭からくり返す。
 * 参照ショートの色順や、ファイル名・更新日時・デコード完了順では並べ替えない。
 */
export function photoIndexForSlot(slot: number, photoCount: number): number {
  if (photoCount <= 0 || slot < 0) return 0;
  return slot % photoCount;
}

/** 縦横ともテンプレは 32 カット。`landscape-cuts.json` の slots 長と一致する。 */
export const TEMPLATE_SLOT_COUNT = TEMPLATE_SLOT_PHOTO_ORDER.length;

/**
 * ある写真が映るカット番号（1 始まり）。
 * 再生と同じく `photoIndexForSlot`（slot % 枚数）で 32 枠を順に埋める。
 * 3 枚なら 1 枚目は 1, 4, 7, 10, …。
 */
export function playbackPositions(
  photoIndex: number,
  photoCount: number,
  slotCount = TEMPLATE_SLOT_COUNT,
): number[] {
  if (photoCount <= 0 || photoIndex < 0 || photoIndex >= photoCount || slotCount <= 0) return [];
  const positions: number[] = [];
  for (let slot = 0; slot < slotCount; slot += 1) {
    if (photoIndexForSlot(slot, photoCount) === photoIndex) positions.push(slot + 1);
  }
  return positions;
}

export function photoForSlot<T>(photos: readonly T[], slot: number): T | undefined {
  if (photos.length === 0) return undefined;
  return photos[photoIndexForSlot(slot, photos.length)];
}

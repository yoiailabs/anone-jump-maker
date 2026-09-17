export type CutTimeline = {
  duration: number;
  /** 各スロットの開始秒（frame/fps）。 */
  slots: number[];
  fps?: number;
  /** `slots` と同じ拍のテンプレフレーム番号（参考用）。 */
  slotFrames?: number[];
  /** テンプレが求める写真の枚数（色分け動画の色数）。 */
  photoCount?: number;
  /** 各スロットに入る写真番号（0..photoCount−1）。テンプレは同じ写真を複数のスロットで使う。 */
  slotPhotoOrder?: number[];
};

/** compositor に渡す最小限。 */
export type SlotTimeline = Pick<CutTimeline, "slots" | "slotPhotoOrder">;

/**
 * 参考テンプレ（色分け動画 utNIG60-li0）の写真スロット。32 カットに 10 色＝10 枚が
 *   A B C D E F G B E A H B A I F I B D H I G H J C H F I J G D A I
 * と並ぶ。A..J → 0..9。
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
 * スロット → 写真番号。
 * - 写真がテンプレの枚数（10）以上: 各写真の初出はテンプレの並びどおり。テンプレで同じ写真が
 *   再登場する位置には、11 枚目以降を出た順に入れ、余った再登場はテンプレどおり同じ写真。
 * - 10 枚未満: スロット順にくり返す（テンプレの並びを剰余で畳むと同じ写真が連続してカットが見えなくなる）。
 * - 並びが無い／並びより先のスロット: スロット順にくり返す。
 */
export function photoIndexForSlot(
  slot: number,
  photoCount: number,
  order: readonly number[] = TEMPLATE_SLOT_PHOTO_ORDER,
): number {
  if (photoCount <= 0) return 0;
  if (slot < 0) return 0;
  const distinct = order.length === 0 ? 0 : Math.max(...order) + 1;
  if (distinct === 0 || photoCount < distinct || slot >= order.length) {
    return slot % photoCount;
  }
  const seen = new Set<number>();
  let nextExtra = distinct;
  let assigned = 0;
  for (let p = 0; p <= slot; p += 1) {
    const base = order[p]!;
    if (!seen.has(base)) {
      seen.add(base);
      assigned = base;
    } else if (nextExtra < photoCount) {
      assigned = nextExtra;
      nextExtra += 1;
    } else {
      assigned = base;
    }
  }
  return assigned;
}

export function photoForSlot<T>(
  photos: readonly T[],
  slot: number,
  order: readonly number[] = TEMPLATE_SLOT_PHOTO_ORDER,
): T | undefined {
  if (photos.length === 0) return undefined;
  return photos[photoIndexForSlot(slot, photos.length, order)];
}

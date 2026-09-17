export type CutTimeline = {
  duration: number;
  /** 各スロットの開始秒（frame/fps）。 */
  slots: number[];
  fps?: number;
  /** `slots` と同じ拍のテンプレフレーム番号（参考用）。 */
  slotFrames?: number[];
};

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

export function photoForSlot<T>(photos: readonly T[], slot: number): T | undefined {
  if (photos.length === 0) return undefined;
  return photos[slot % photos.length];
}

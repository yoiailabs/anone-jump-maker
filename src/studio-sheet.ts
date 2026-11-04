export const STUDIO_TABS = ["photos", "motion", "look"] as const;
export type StudioTab = (typeof STUDIO_TABS)[number];

/** これより長く縦に引いたら開閉する。短い揺れはタップ扱い。 */
export const SHEET_DRAG_THRESHOLD = 40;
/** ドラッグ中に指へ追従させる上限。閉じた状態から上へ引くときだけ使う。 */
export const SHEET_DRAG_PULL_LIMIT = 80;

/** タブの矢印キー移動。端では反対側へ回る。対象外のキーは null。 */
export function tabForKey(key: string, current: StudioTab): StudioTab | null {
  const index = STUDIO_TABS.indexOf(current);
  const last = STUDIO_TABS.length - 1;
  if (key === "ArrowRight") return STUDIO_TABS[index === last ? 0 : index + 1]!;
  if (key === "ArrowLeft") return STUDIO_TABS[index === 0 ? last : index - 1]!;
  if (key === "Home") return STUDIO_TABS[0];
  if (key === "End") return STUDIO_TABS[last]!;
  return null;
}

/** プレイヤー下の「N枚 · 停止中」の文言キー。英語は 1 枚のとき単数形にする。 */
export function studioStatusKey(count: number): "studioStatus" | "studioStatusOne" {
  return count === 1 ? "studioStatusOne" : "studioStatus";
}

/** 開いたシートは下へだけ、閉じたシートは上へだけ指に付いていく。 */
export function sheetDragOffset(open: boolean, dy: number): number {
  return open ? Math.max(0, dy) : Math.max(-SHEET_DRAG_PULL_LIMIT, Math.min(0, dy));
}

/** 指を離したときの開閉。しきい値に届かなければ元のまま。 */
export function sheetOpenAfterDrag(open: boolean, dy: number): boolean {
  if (open && dy > SHEET_DRAG_THRESHOLD) return false;
  if (!open && dy < -SHEET_DRAG_THRESHOLD) return true;
  return open;
}

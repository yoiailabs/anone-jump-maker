/** 選んだ写真の順番・追加・削除。UI と boot から共有する。 */

/** テンプレは 32 カット。それ以上の写真はフレームに出ないので選ばせない。 */
export const PHOTO_MAX_COUNT = 32;

export function takeUpToPhotoCap<T>(
  currentCount: number,
  incoming: readonly T[],
  max = PHOTO_MAX_COUNT,
): T[] {
  if (incoming.length === 0 || currentCount >= max) return [];
  return incoming.slice(0, max - currentCount);
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return [...items];
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function removeById<T extends { id: string }>(
  items: readonly T[],
  id: string,
): { removed: T | undefined; rest: T[] } {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return { removed: undefined, rest: [...items] };
  const rest = [...items];
  const [removed] = rest.splice(index, 1);
  return { removed, rest };
}

export function appendAll<T>(items: readonly T[], extra: readonly T[]): T[] {
  return extra.length === 0 ? [...items] : [...items, ...extra];
}

export function orderByIds<T extends { id: string }>(items: readonly T[], ids: readonly string[]): T[] {
  const map = new Map(items.map((item) => [item.id, item]));
  const next: T[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const item = map.get(id);
    if (!item || seen.has(id)) continue;
    next.push(item);
    seen.add(id);
  }
  for (const item of items) {
    if (!seen.has(item.id)) next.push(item);
  }
  return next;
}

export function sameIdOrder<T extends { id: string }>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

type PointRect = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;

/** 折り返しグリッドで、ポインタに一番近い項目の添字。 */
export function nearestIndexByPoint(
  clientX: number,
  clientY: number,
  rects: readonly PointRect[],
): number {
  if (rects.length === 0) return 0;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i]!;
    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;
    const dist = Math.hypot(clientX - midX, clientY - midY);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** 横並びサムネの中で、ポインタ X に一番近い項目の添字。 */
export function nearestIndexByClientX(
  clientX: number,
  rects: readonly Pick<DOMRectReadOnly, "left" | "width">[],
): number {
  return nearestIndexByPoint(
    clientX,
    0,
    rects.map((rect) => ({ left: rect.left, top: 0, width: rect.width, height: 0 })),
  );
}

/** ドロップ位置。同じ行なら中心より左でその前、行末より右なら次行の先頭。 */
export function insertionIndexByPoint(
  clientX: number,
  clientY: number,
  rects: readonly PointRect[],
): number {
  if (rects.length === 0) return 0;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i]!;
    const next = rects[i + 1];
    const midX = rect.left + rect.width / 2;
    const endsRow = next === undefined || next.top >= rect.top + rect.height / 2;
    if (clientY < rect.top) return i;
    if (clientY <= rect.top + rect.height) {
      if (clientX < midX) return i;
      if (endsRow) return i + 1;
    }
  }
  return rects.length;
}

/** ドロップ位置。各項目の中心より左ならその前、全部より右なら末尾。 */
export function insertionIndexByClientX(
  clientX: number,
  rects: readonly Pick<DOMRectReadOnly, "left" | "width">[],
): number {
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i]!;
    if (clientX < rect.left + rect.width / 2) return i;
  }
  return rects.length;
}

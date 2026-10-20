/** 元解像度の外周で 3px 間隔を目標にし、巨大な出力でも計算量を制限する。 */
export function spinBlurPlan(
  width: number,
  height: number,
  angle: number,
): { width: number; height: number; taps: number } {
  const arc = Math.abs(angle) * Math.hypot(width, height) / 2;
  // 弱いブラーは原寸を保つ。強いブラーは長辺 384px で積分し、最後に拡大する。
  const down = Math.min(1, Math.max(384 / Math.max(width, height), 8 / Math.max(8, arc)));
  return {
    width: Math.max(1, Math.round(width * down)),
    height: Math.max(1, Math.round(height * down)),
    taps: arc === 0 ? 1 : Math.min(192, Math.max(2, Math.ceil(arc / 3) + 1)),
  };
}

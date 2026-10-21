export type GlitchStyle = {
  preset: "wide-left" | "fine-right" | "mixed" | "diagonal" | "vertical";
  strength: number;
  direction: -1 | 0 | 1;
  slices: number;
  thickness: readonly [number, number];
  fragments: number;
  fragmentBand: number;
  rgbDirection: -1 | 1;
  rgbLead: number;
  rgbScale: number;
  rgbVertical: number;
  peak: -1 | -2;
  jitter: number;
};

/** カットと相対フレームだけで決まるハッシュ。再生順や呼び出し回数には依存しない。 */
export function glitchNoise(cut: number, frame: number, lane: number): number {
  let x = Math.imul(cut, 0x9e3779b1) ^ Math.imul(frame, 0x85ebca6b) ^ Math.imul(lane, 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000;
}

// 太さ・本数・方向を分け、強度だけが違うカットの繰り返しを避ける。割合は短辺比。
const PRESETS: readonly GlitchStyle[] = [
  { preset: "wide-left", strength: 0.78, direction: -1, slices: 6, thickness: [0.045, 0.085], fragments: 2, fragmentBand: 0.25, rgbDirection: -1, rgbLead: 0, rgbScale: 0.85, rgbVertical: 0, peak: -1, jitter: 0 },
  { preset: "fine-right", strength: 0.96, direction: 1, slices: 14, thickness: [0.008, 0.022], fragments: 6, fragmentBand: 0.75, rgbDirection: 1, rgbLead: 2, rgbScale: 0.95, rgbVertical: 0, peak: -2, jitter: 0 },
  { preset: "mixed", strength: 1.08, direction: 0, slices: 10, thickness: [0.018, 0.05], fragments: 4, fragmentBand: 0.5, rgbDirection: -1, rgbLead: 1, rgbScale: 1, rgbVertical: 0, peak: -1, jitter: 0 },
  { preset: "diagonal", strength: 1.22, direction: 1, slices: 8, thickness: [0.022, 0.055], fragments: 3, fragmentBand: 0.3, rgbDirection: 1, rgbLead: 0, rgbScale: 1.1, rgbVertical: 0.35, peak: -2, jitter: 0 },
  { preset: "vertical", strength: 0.88, direction: -1, slices: 12, thickness: [0.012, 0.032], fragments: 5, fragmentBand: 0.7, rgbDirection: -1, rgbLead: 2, rgbScale: 0.9, rgbVertical: -0.25, peak: -1, jitter: 0.004 },
];

/** 5 種を毎周期シャッフル。末尾を周期から固定し、前周期末尾と先頭の重複も防ぐ。 */
export function glitchStyle(cutIndex: number): GlitchStyle {
  const cut = Math.max(1, Math.floor(cutIndex));
  const cycle = Math.floor((cut - 1) / PRESETS.length);
  const last = cycle % PRESETS.length;
  const order = PRESETS.map((_, i) => i).filter((i) => i !== last);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(glitchNoise(cycle, 0, 200 + i) * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const previousLast = (cycle + PRESETS.length - 1) % PRESETS.length;
  if (order[0] === previousLast) [order[0], order[1]] = [order[1]!, order[0]!];
  order.push(last);
  const base = PRESETS[order[(cut - 1) % PRESETS.length]!]!;
  return {
    ...base,
    thickness: [...base.thickness],
    strength: base.strength + (glitchNoise(cut, 0, 220) - 0.5) * 0.06,
    rgbScale: base.rgbScale + (glitchNoise(cut, 0, 221) - 0.5) * 0.08,
    fragmentBand: base.fragmentBand + (glitchNoise(cut, 0, 222) - 0.5) * 0.1,
  };
}

/** 新写真の初出を空け、ピークが S-2 のときは S-1 で既に減衰させる。 */
export function glitchEnvelope(frame: number, peak: -1 | -2): number {
  const amounts = peak === -1
    ? [0.2, 0.4, 0.6, 0.8, 1, 0, 0.45, 0.3, 0.18, 0.08]
    : [0.25, 0.5, 0.75, 1, 0.55, 0, 0.35, 0.24, 0.14, 0.06];
  return amounts[frame + 5] ?? 0;
}

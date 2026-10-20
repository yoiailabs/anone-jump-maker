import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyColorFilter, buildColorTransform, COLOR_FILTERS, colorFilterLabel, isColorFilter } from "./color-filter.ts";
import { LOCALES } from "./i18n.ts";
import { ASPECT_MODES, IMAGE_FILTERS, SWAP_STYLES } from "./layout.ts";
import { exportFileName } from "./modes.ts";
import { pickTraceAttributes } from "./sentry.ts";
import { videoEventParams } from "./analytics.ts";

it("accepts exactly the eight color tokens, independently of legacy blur tokens", () => {
  for (const filter of COLOR_FILTERS) expect(isColorFilter(filter)).toBe(true);
  for (const filter of ["blur-weak", "blur-strong", "", "Dramatic", "constructor"]) expect(isColorFilter(filter)).toBe(false);
});

it("has short, distinct labels in every locale", () => {
  for (const locale of LOCALES) {
    const labels = COLOR_FILTERS.map((filter) => colorFilterLabel(filter, locale));
    expect(new Set(labels).size).toBe(8);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(10);
      expect(label).not.toContain("makerFilter");
    }
  }
  expect(colorFilterLabel("dramatic", "ja")).toBe("ドラマチック");
  expect(colorFilterLabel("sepia", "en")).toBe("Sepia");
});

describe("deterministic matrix and tone LUT", () => {
  it("none has identity matrix/LUT and preserves every input byte", () => {
    const { matrix, lut } = buildColorTransform("none");
    expect(matrix).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    for (const channel of lut) expect([...channel]).toEqual(Array.from({ length: 256 }, (_, i) => i));
    const data = Uint8ClampedArray.from({ length: 1024 }, (_, i) => i % 256);
    const before = data.slice();
    applyColorFilter(data, "none");
    expect(data).toEqual(before);
  });

  it("uses Rec.709 luma for mono and retains alpha", () => {
    expect(buildColorTransform("mono").matrix).toEqual(Array(3).fill([0.2126, 0.7152, 0.0722]));
    const data = new Uint8ClampedArray([255, 0, 0, 123, 0, 255, 0, 0, 0, 0, 255, 255]);
    applyColorFilter(data, "mono");
    expect([...data]).toEqual([50, 50, 50, 123, 185, 185, 185, 0, 11, 11, 11, 255]);
  });

  it.each(COLOR_FILTERS)("%s bounds tones and preserves alpha on a color ramp", (filter) => {
    const { lut } = buildColorTransform(filter);
    for (const channel of lut) {
      expect(channel.length).toBe(256);
      expect([...channel].every((v, i) => i === 0 || v >= channel[i - 1]!)).toBe(true);
    }
    const data = Uint8ClampedArray.from({ length: 1024 }, (_, i) => i % 256);
    const before = data.slice();
    applyColorFilter(data, filter);
    for (let i = 3; i < data.length; i += 4) expect(data[i]).toBe(before[i]);
  });

  it("keeps a lifted film black, warm/cool balance, and stronger dynamic saturation", () => {
    const sample = (filter: typeof COLOR_FILTERS[number], rgb: number[]) => {
      const data = new Uint8ClampedArray([...rgb, 255]);
      applyColorFilter(data, filter);
      return [...data].slice(0, 3);
    };
    expect(sample("film", [0, 0, 0]).every((v) => v >= 20)).toBe(true);
    expect(sample("warm", [128, 128, 128])[0]).toBeGreaterThan(sample("warm", [128, 128, 128])[2]!);
    expect(sample("cool", [128, 128, 128])[2]).toBeGreaterThan(sample("cool", [128, 128, 128])[0]!);
    expect(sample("dynamic", [180, 100, 80])[0]! - sample("dynamic", [180, 100, 80])[2]!).toBeGreaterThan(100);
    expect(sample("dramatic", [40, 40, 40])[0]).toBeLessThan(40);
  });
});

it("names every aspect × effect × blur × color × container combination", () => {
  const seen = new Set<string>();
  for (const mode of ASPECT_MODES) for (const style of SWAP_STYLES) for (const blur of IMAGE_FILTERS) {
    for (const color of COLOR_FILTERS) for (const ext of ["mp4", "webm"]) {
      const name = exportFileName(mode, style, ext, blur, color);
      const tags = ["anone", style, mode === "landscape" ? "16x9" : "9x16"];
      if (blur !== "none") tags.push(blur);
      if (color !== "none") tags.push(color);
      expect(name).toBe(`${tags.join("-")}.${ext}`);
      seen.add(name);
    }
  }
  expect(seen.size).toBe(192);
});

it("keeps filter as blur and admits color_filter separately in Sentry and analytics", () => {
  for (const blur of IMAGE_FILTERS) for (const color of COLOR_FILTERS) {
    const attrs = { filter: blur, color_filter: color };
    expect(pickTraceAttributes(attrs)).toEqual(attrs);
    expect(videoEventParams("landscape", "zoom", blur, color)).toMatchObject(attrs);
  }
  expect(pickTraceAttributes({ filter: "sepia", color_filter: "blur-weak" })).toEqual({});
  const app = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
  expect(app.match(/filter: imageFilter,\s+color_filter: colorFilter,/g)).toHaveLength(2);
});

it("never sets Canvas2D filter for color processing", () => {
  const source = readFileSync(new URL("./color-filter.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/\.filter\s*=/);
});

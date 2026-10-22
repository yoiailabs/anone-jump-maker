import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyColorFilter, buildColorTransform, COLOR_FILTERS, COLOR_FILTER_RECIPES, colorFilterLabel, isColorFilter, normalizeColorFilter, type ColorFilter } from "./color-filter.ts";
import retiredColorFilters from "../tests/fixtures/retired-color-filters.json" with { type: "json" };
import { LOCALES } from "./i18n.ts";
import { ASPECT_MODES, IMAGE_FILTERS, SWAP_STYLES } from "./layout.ts";
import { exportFileName } from "./modes.ts";
import { pickTraceAttributes } from "./sentry.ts";
import { videoEventParams } from "./analytics.ts";

it("accepts exactly the four color tokens, independently of legacy blur tokens", () => {
  expect(COLOR_FILTERS).toEqual(["none", "dynamic", "dramatic", "film"]);
  expect(Object.keys(COLOR_FILTER_RECIPES).sort()).toEqual([...COLOR_FILTERS].sort());
  for (const filter of COLOR_FILTERS) {
    expect(isColorFilter(filter)).toBe(true);
    expect(normalizeColorFilter(filter)).toBe(filter);
  }
  for (const filter of [...retiredColorFilters, "blur-weak", "blur-strong", "", "Dramatic", "constructor", "toString", undefined, null, 1, {}]) {
    expect(isColorFilter(filter)).toBe(false);
    expect(normalizeColorFilter(filter)).toBe("none");
  }
});

it("has short, distinct labels in every locale", () => {
  for (const locale of LOCALES) {
    const labels = COLOR_FILTERS.map((filter) => colorFilterLabel(filter, locale));
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(10);
      expect(label).not.toContain("makerFilter");
    }
  }
  expect(colorFilterLabel("dramatic", "ja")).toBe("ドラマチック");
  expect(colorFilterLabel("film", "en")).toBe("Film");
});

it("keeps the retained recipes at their approved values", () => {
  expect(COLOR_FILTER_RECIPES.dramatic).toEqual({ saturation: 0.82, contrast: 1.18, gamma: 1.06, lift: 0, gain: [1, 1, 1] });
  expect(COLOR_FILTER_RECIPES.dynamic).toEqual({ saturation: 1.18, contrast: 1.12, gamma: 1, lift: 0, gain: [1, 1, 1] });
  expect(COLOR_FILTER_RECIPES.film).toEqual({ saturation: 0.78, contrast: 0.88, gamma: 1, lift: 10, gain: [1.03, 1, 0.96] });
});

describe("deterministic matrix and tone LUT", () => {
  const sample = (filter: typeof COLOR_FILTERS[number], rgb: readonly number[]) => {
    const data = new Uint8ClampedArray([...rgb, 255]);
    applyColorFilter(data, filter);
    return [...data].slice(0, 3);
  };

  it("none has identity matrix/LUT and preserves every input byte", () => {
    const { matrix, lut } = buildColorTransform("none");
    expect(matrix).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    for (const channel of lut) expect([...channel]).toEqual(Array.from({ length: 256 }, (_, i) => i));
    const data = Uint8ClampedArray.from({ length: 1024 }, (_, i) => i % 256);
    const before = data.slice();
    applyColorFilter(data, "none");
    expect(data).toEqual(before);
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

  it("keeps a lifted film black and stronger dynamic saturation", () => {
    expect(sample("film", [0, 0, 0]).every((v) => v >= 20)).toBe(true);
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
  expect(seen.size).toBe(ASPECT_MODES.length * SWAP_STYLES.length * IMAGE_FILTERS.length * COLOR_FILTERS.length * 2);
  expect(SWAP_STYLES).toContain("mist");
});

it("keeps filter as blur and admits color_filter separately in Sentry and analytics", () => {
  for (const blur of IMAGE_FILTERS) for (const color of COLOR_FILTERS) {
    const attrs = { filter: blur, color_filter: color };
    expect(pickTraceAttributes(attrs)).toEqual(attrs);
    expect(videoEventParams("landscape", "zoom", blur, color)).toMatchObject(attrs);
  }
  expect(pickTraceAttributes({ filter: "film", color_filter: "blur-weak" })).toEqual({ color_filter: "none" });
  const app = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
  expect(app.match(/filter: imageFilter,\s+color_filter: colorFilter,/g)).toHaveLength(2);
});

it.each([...retiredColorFilters, "future-filter", "constructor", undefined, null, 42, {}])(
  "normalizes invalid color %j in telemetry and filenames without changing blur",
  (value) => {
    // Simulate stale/runtime values crossing the TypeScript boundary.
    const color = value as ColorFilter;
    for (const blur of IMAGE_FILTERS) {
      expect(pickTraceAttributes({ filter: blur, color_filter: value })).toEqual({ filter: blur, color_filter: "none" });
      expect(videoEventParams("landscape", "zoom", blur, color)).toMatchObject({ filter: blur, color_filter: "none" });
      for (const extension of ["mp4", "webm"]) {
        expect(exportFileName("landscape", "zoom", extension, blur, color))
          .toBe(exportFileName("landscape", "zoom", extension, blur, "none"));
      }
    }
  },
);

it("never sets Canvas2D filter for color processing", () => {
  const source = readFileSync(new URL("./color-filter.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/\.filter\s*=/);
});

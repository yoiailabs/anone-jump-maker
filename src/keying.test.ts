import { describe, expect, it } from "vitest";
import {
  KEY_DESPILL_INNER,
  KEY_DESPILL_STRENGTH,
  KEY_GREEN_KILL,
  KEY_PARAMS,
  KEY_SAMPLE_COUNT,
  colorDistance,
  despill,
  keyAlpha,
  keyImageData,
  keySamplePixels,
  keySampleUvBottomLeft,
  luma,
  sampleKeyColor,
} from "./keying.ts";

describe("keyAlpha", () => {
  it("keys a near-solid background", () => {
    const teal = [68, 155, 163] as const;
    expect(keyAlpha(...teal, ...teal)).toBe(0);
    expect(keyAlpha(70, 154, 160, ...teal)).toBeLessThan(0.15);
  });

  it("keeps line-art black opaque even on a close key", () => {
    expect(keyAlpha(8, 8, 8, 68, 155, 163)).toBe(1);
  });

  it("keeps white clothing on a gray plate", () => {
    expect(keyAlpha(244, 244, 244, 123, 123, 123)).toBeGreaterThan(0.9);
  });

  it("assists green chroma", () => {
    const lime = [184, 224, 108] as const;
    expect(keyAlpha(...lime, ...lime)).toBe(0);
    expect(keyAlpha(40, 220, 40, 10, 10, 10)).toBeLessThan(0.3);
    const plate = [20, 182, 54] as const;
    expect(keyAlpha(...plate, ...plate)).toBe(0);
    expect(keyAlpha(24, 176, 58, ...plate)).toBeLessThan(0.2);
    // landscape.mp4 の緑は vertical より明るい。同じ許容で抜ける。
    const landscape = [32, 208, 58] as const;
    expect(keyAlpha(...landscape, ...landscape)).toBe(0);
    expect(keyAlpha(36, 204, 62, ...landscape)).toBeLessThan(0.2);
    expect(keyAlpha(8, 8, 8, ...landscape)).toBe(1);
    expect(keyAlpha(244, 244, 244, ...landscape)).toBeGreaterThan(0.9);
  });

  it("uses the shared thresholds", () => {
    expect(KEY_PARAMS.tolerance).toBeGreaterThan(20);
    expect(KEY_PARAMS.darkProtect).toBeLessThan(80);
    expect(KEY_GREEN_KILL).toBe(0.85);
    expect(KEY_DESPILL_INNER).toBe(0.4);
    expect(KEY_DESPILL_STRENGTH).toBe(0.7);
  });
});

describe("key sample points", () => {
  it("uses seven corner / top-edge pixels", () => {
    const points = keySamplePixels(1280, 720);
    expect(points).toHaveLength(KEY_SAMPLE_COUNT);
    expect(points[0]).toEqual([2, 2]);
    expect(points[1]).toEqual([1277, 2]);
    expect(points[2]).toEqual([640, 3]);
    expect(points[5]).toEqual([2, 717]);
    expect(points[6]).toEqual([1277, 717]);
  });

  it("maps those pixels to WebGL UVs with the band and Y flip", () => {
    const uv = keySampleUvBottomLeft(100, 50, [0.1, 0.2, 0.4, 0.3]);
    expect(uv).toHaveLength(KEY_SAMPLE_COUNT * 2);
    // pixel (2, 2) → GL (2.5/100, 1 - 2.5/50) then into the band
    expect(uv[0]).toBeCloseTo(0.1 + 0.025 * 0.4);
    expect(uv[1]).toBeCloseTo(0.2 + (1 - 0.05) * 0.3);
  });
});

describe("keyImageData", () => {
  it("keys a solid plate and keeps a dark line opaque", () => {
    expect(colorDistance(0, 0, 0, 0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255, 5);
    const despilled = despill(40, 200, 40, 20, 180, 50);
    expect(despilled[1]).toBeLessThan(200);

    const width = 8;
    const height = 8;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 20;
      data[i + 1] = 182;
      data[i + 2] = 54;
      data[i + 3] = 255;
    }
    const line = ((4 * width + 4) * 4);
    data[line] = 8;
    data[line + 1] = 8;
    data[line + 2] = 8;
    const image = { data, width, height } as ImageData;
    const key = sampleKeyColor(data, width, height);
    expect(key[1]).toBeGreaterThan(key[0]!);
    keyImageData(image);
    expect(data[3]).toBe(0);
    expect(data[line + 3]).toBe(255);
  });

  it("keys the brighter landscape green without punching a dark stroke", () => {
    const width = 32;
    const height = 18;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 32;
      data[i + 1] = 208;
      data[i + 2] = 58;
      data[i + 3] = 255;
    }
    for (let x = 8; x < 24; x += 1) {
      const i = (9 * width + x) * 4;
      data[i] = 12;
      data[i + 1] = 12;
      data[i + 2] = 12;
    }
    const image = { data, width, height } as ImageData;
    const key = keyImageData(image);
    expect(key[0]).toBeCloseTo(32, 0);
    expect(key[1]).toBeGreaterThan(200);
    expect(data[3]).toBe(0);
    const stroke = (9 * width + 12) * 4;
    expect(data[stroke + 3]).toBe(255);
    expect(data[stroke + 1]).toBeLessThan(40);
  });
});

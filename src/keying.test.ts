import { describe, expect, it } from "vitest";
import { KEY_PARAMS, keyAlpha } from "./keying.ts";

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
  });

  it("uses the shared thresholds", () => {
    expect(KEY_PARAMS.tolerance).toBeGreaterThan(20);
    expect(KEY_PARAMS.darkProtect).toBeLessThan(80);
  });
});

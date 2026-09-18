import { describe, expect, it } from "vitest";
import {
  KEY_DESPILL_INNER,
  KEY_DESPILL_STRENGTH,
  KEY_GREEN_KILL,
  KEY_PARAMS,
  KEY_SAMPLE_COUNT,
} from "./keying.ts";
import {
  createGpuKeyer,
  gpuKeyUniforms,
  KEYING_FRAGMENT_SHADER,
  pickKeyingBackend,
  shouldDropGpuKeyer,
  shouldUseGpuFrame,
} from "./keying-gpu.ts";

const fakeKeyer = {
  canvas: {} as HTMLCanvasElement,
  keyVideoBand: () => true,
  destroy() {},
  isLost: () => false,
};

describe("pickKeyingBackend", () => {
  it("selects WebGL when a keyer exists and CPU otherwise", () => {
    expect(pickKeyingBackend(null)).toBe("cpu");
    expect(pickKeyingBackend(fakeKeyer)).toBe("webgl");
  });
});

describe("shouldUseGpuFrame", () => {
  it("uses GPU only while the frame succeeds; a missed frame does not destroy the keyer", () => {
    expect(shouldUseGpuFrame(fakeKeyer, true)).toBe(true);
    expect(shouldUseGpuFrame(fakeKeyer, false)).toBe(false);
    expect(shouldUseGpuFrame(null, true)).toBe(false);
    expect(shouldUseGpuFrame(null, false)).toBe(false);
    expect(shouldDropGpuKeyer(false)).toBe(false);
    expect(shouldDropGpuKeyer(true)).toBe(true);
  });
});

describe("gpuKeyUniforms", () => {
  it("forwards KEY_PARAMS and the shared despill / green-kill constants", () => {
    expect(gpuKeyUniforms()).toEqual({
      tolerance: KEY_PARAMS.tolerance,
      softness: KEY_PARAMS.softness,
      darkProtect: KEY_PARAMS.darkProtect,
      greenBoost: KEY_PARAMS.greenBoost,
      greenSoft: KEY_PARAMS.greenSoft,
      greenKill: KEY_GREEN_KILL,
      despillInner: KEY_DESPILL_INNER,
      despillStrength: KEY_DESPILL_STRENGTH,
    });
  });
});

describe("KEYING_FRAGMENT_SHADER", () => {
  it("embeds the CPU key formula (distance, green assist, dark protect, despill)", () => {
    expect(KEYING_FRAGMENT_SHADER).toContain(`u_keyUv[${KEY_SAMPLE_COUNT}]`);
    expect(KEYING_FRAGMENT_SHADER).toContain("distance(rgb, kc)");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_tolerance");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_softness");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_darkProtect");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_greenBoost");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_greenSoft");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_greenKill");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_despillInner");
    expect(KEYING_FRAGMENT_SHADER).toContain("u_despillStrength");
    expect(KEYING_FRAGMENT_SHADER).toContain("0.299");
    expect(KEYING_FRAGMENT_SHADER).toContain("0.587");
    expect(KEYING_FRAGMENT_SHADER).toContain("0.114");
  });
});

describe("createGpuKeyer", () => {
  it("returns null in Node (no document / no WebGL). Headless CI cannot compile the shader.", () => {
    expect(typeof document).toBe("undefined");
    expect(createGpuKeyer()).toBeNull();
    expect(pickKeyingBackend(createGpuKeyer())).toBe("cpu");
  });
});

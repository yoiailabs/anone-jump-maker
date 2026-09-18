import { describe, expect, it } from "vitest";
import {
  GENERATE_ENCODER,
  GENERATE_FLOW,
  GENERATE_LABEL,
  GENERATE_PIXEL_ENGINE,
  GENERATE_READY_STATUS,
  GENERATE_STALE_STATUS,
  MEMORY_ERROR_MESSAGE,
  REGENERATE_LABEL,
  actionAvailability,
  generateButtonLabel,
  generateProgressText,
  generationErrorMessage,
  isArtifactCurrent,
  isMemoryError,
  photosLoadedStatus,
  settingsFingerprint,
} from "./generate.ts";

describe("generate-first contract", () => {
  it("generates once, then preview and save share that artifact", () => {
    expect(GENERATE_FLOW).toBe("generate-first");
    expect(GENERATE_PIXEL_ENGINE).toBe("wasm");
    expect(GENERATE_ENCODER).toBe("webcodecs-mediabunny");
    expect(GENERATE_LABEL).toBe("生成");
    expect(REGENERATE_LABEL).toBe("再生成");
    expect(GENERATE_READY_STATUS).toContain("プレビュー");
    expect(GENERATE_READY_STATUS).toContain("保存");
  });

  it("does not treat Canvas2D live composite as the generation engine", () => {
    expect(GENERATE_PIXEL_ENGINE).not.toBe("canvas2d");
    expect(GENERATE_ENCODER).not.toBe("ffmpeg.wasm");
  });
});

describe("settingsFingerprint", () => {
  const base = {
    aspect: "landscape" as const,
    swap: "jump" as const,
    filter: "none" as const,
    photoIds: ["a", "b"],
  };

  it("changes when photos, aspect, effect, or filter change", () => {
    const current = settingsFingerprint(base);
    expect(isArtifactCurrent(current, base)).toBe(true);
    expect(isArtifactCurrent(current, { ...base, aspect: "portrait" })).toBe(false);
    expect(isArtifactCurrent(current, { ...base, swap: "zoom" })).toBe(false);
    expect(isArtifactCurrent(current, { ...base, filter: "blur-weak" })).toBe(false);
    expect(isArtifactCurrent(current, { ...base, photoIds: ["a", "c"] })).toBe(false);
    expect(isArtifactCurrent(null, base)).toBe(false);
  });
});

describe("actionAvailability", () => {
  it("enables generate when photos and template are ready", () => {
    expect(
      actionAvailability({
        generating: false,
        photosReady: true,
        templateReady: true,
        hasCurrentArtifact: false,
      }),
    ).toEqual({ canGenerate: true, canPreview: false, canSave: false });
  });

  it("enables preview and save only after a current artifact exists", () => {
    expect(
      actionAvailability({
        generating: false,
        photosReady: true,
        templateReady: true,
        hasCurrentArtifact: true,
      }),
    ).toEqual({ canGenerate: true, canPreview: true, canSave: true });
    expect(generateButtonLabel(true)).toBe(REGENERATE_LABEL);
    expect(generateButtonLabel(false)).toBe(GENERATE_LABEL);
  });

  it("locks every action while generating", () => {
    expect(
      actionAvailability({
        generating: true,
        photosReady: true,
        templateReady: true,
        hasCurrentArtifact: true,
      }),
    ).toEqual({ canGenerate: false, canPreview: false, canSave: false });
  });
});

describe("generate copy", () => {
  it("shows frame progress and a stale warning", () => {
    expect(generateProgressText(12, 466)).toBe("生成中… 12 / 466");
    expect(GENERATE_STALE_STATUS).toContain("もう一度生成");
    expect(photosLoadedStatus(0)).toBe("画像ファイルを選んでください");
    expect(photosLoadedStatus(3)).toContain("3 枚");
  });
});

describe("generationErrorMessage", () => {
  it("maps allocation failures to an actionable memory hint", () => {
    const oom = new RangeError("Array buffer allocation failed");
    expect(isMemoryError(oom)).toBe(true);
    expect(generationErrorMessage(oom)).toBe(MEMORY_ERROR_MESSAGE);
    expect(generationErrorMessage(new Error("シークがタイムアウトしました"))).toBe(
      "シークがタイムアウトしました",
    );
    expect(generationErrorMessage("nope", "生成に失敗しました")).toBe("生成に失敗しました");
  });
});

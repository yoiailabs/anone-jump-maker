import { afterEach, describe, expect, it } from "vitest";
import { createCompositor } from "./compositor.ts";
import {
  characterDest,
  characterOutlinePx,
  characterScale,
  OUTPUTS,
  PORTRAIT_INK_BOTTOM,
  PORTRAIT_STICKER_BOTTOM,
  portraitCutY,
  templateBandRect,
  type CharacterSize,
} from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";

afterEach(() => {
  document.querySelectorAll("canvas, video").forEach((el) => el.remove());
});

const GREEN = "#14b636";
const RED = "#ff5e5f";

function paintPlate(cutSrc: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 608;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 312, 608, 342);
  ctx.fillStyle = "#111111";
  ctx.fillRect(160, cutSrc - 80, 280, 80);
  // 固定カットより上の小さなパーツ。この下の白縁は残す。
  ctx.fillRect(460, 360, 70, 50);
  return canvas;
}

async function redPhoto(): Promise<LoadedPhoto> {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, 64, 64);
  const bitmap = await createImageBitmap(canvas);
  return { id: "red", name: "red.png", bitmap, thumbUrl: "" };
}

function isWhite(px: Uint8ClampedArray): boolean {
  return (px[0] ?? 0) > 230 && (px[1] ?? 0) > 230 && (px[2] ?? 0) > 230;
}

function isRed(px: Uint8ClampedArray): boolean {
  return (px[0] ?? 0) > 220 && (px[1] ?? 0) < 140 && (px[2] ?? 0) < 140;
}

describe("portrait horizontal cut", () => {
  it("clips the outline at the fixed ink bottom for every character size", async () => {
    const photo = await redPhoto();
    const compositor = createCompositor({ resolutionScale: 1, createKeyer: () => null });
    compositor.setAspect("portrait");
    const video = document.createElement("video");
    const timeline = { slots: [0, 5] };
    const { width, height } = OUTPUTS.portrait;
    const band = templateBandRect(608, 1080, "portrait");
    const cutSrc = band.y + PORTRAIT_INK_BOTTOM * band.h;
    const plate = paintPlate(cutSrc);
    try {
      for (const size of ["standard", "1.2", "1.4"] as const satisfies readonly CharacterSize[]) {
        const dest = characterDest(width, height, characterScale("portrait", size), 0, "portrait");
        const cutY = portraitCutY(dest);
        expect(cutY / height, size).toBeCloseTo(PORTRAIT_STICKER_BOTTOM, 5);
        compositor.draw(
          video,
          [photo],
          timeline,
          7 / 30,
          "jump",
          "none",
          { source: plate, width: 608, height: 1080 },
          size,
        );
        const ctx = compositor.canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        const at = (x: number, y: number) => ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        const bodyX = dest.x + (300 / 608) * dest.w;
        let sawBody = false;
        let sawPhoto = false;
        for (let dy = -6; dy <= characterOutlinePx(width) + 3; dy += 1) {
          const px = at(bodyX, cutY + dy);
          expect(isWhite(px), `white under cut ${size} dy ${dy}`).toBe(false);
          if (!isRed(px)) sawBody = true;
          if (sawBody && isRed(px)) sawPhoto = true;
        }
        expect(sawBody, `body visible at ${size}`).toBe(true);
        expect(sawPhoto, `photo resumes under cut ${size}`).toBe(true);
        const bodyLeft = dest.x + (160 / 608) * dest.w;
        // WebKit は縁を 1px ぼかすので、端のちょうど 1px ではなく数 px の範囲で白を探す。
        const sideOutline = [-3, -2, -1].some((dx) => isWhite(at(bodyLeft + dx, cutY - 24)));
        expect(sideOutline, `side outline ${size}`).toBe(true);
        if (size === "standard") {
          const handBottom = dest.y + ((410 - band.y) / band.h) * dest.h;
          const handX = dest.x + (495 / 608) * dest.w;
          const underHand = [-1, 0, 1, 2, 3].some((dy) =>
            [-1, 0, 1].some((dx) => isWhite(at(handX + dx, handBottom + dy))),
          );
          expect(underHand, "outline under a part above the cut").toBe(true);
        }
      }
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });

  it("still draws the downward outline on the landscape plate", async () => {
    const photo = await redPhoto();
    const compositor = createCompositor({ resolutionScale: 1, createKeyer: () => null });
    const plate = document.createElement("canvas");
    plate.width = 1280;
    plate.height = 720;
    const pctx = plate.getContext("2d");
    if (!pctx) throw new Error("canvas");
    pctx.fillStyle = GREEN;
    pctx.fillRect(0, 0, 1280, 720);
    pctx.fillStyle = "#111111";
    pctx.fillRect(400, 200, 480, 200);
    const video = document.createElement("video");
    try {
      compositor.setAspect("landscape");
      compositor.draw(
        video,
        [photo],
        { slots: [0, 5] },
        7 / 30,
        "jump",
        "none",
        { source: plate, width: 1280, height: 720 },
        "standard",
      );
      const ctx = compositor.canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      const under = ctx.getImageData(640, 401, 1, 1).data;
      expect(isWhite(under)).toBe(true);
    } finally {
      photo.bitmap.close();
      compositor.destroy();
    }
  });
});

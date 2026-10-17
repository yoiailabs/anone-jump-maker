import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAKER_LOGO_STACKED_SRC } from "./brand.ts";
import { JUMP_LOOP_STILL_SRC, JUMP_LOOP_VIDEO_SRC } from "./components/JumpLoop.tsx";
import { TEMPLATES } from "./layout.ts";
import { OG_IMAGE_URL, ogImageUrl } from "./page-meta.ts";

const root = new URL("../", import.meta.url);

/** MIT の対象外。public/official-assets/LICENSE.md の表と一致させる。 */
const EXCLUDED = [
  "template/vertical.mp4",
  "template/landscape.mp4",
  "jump-loop.mp4",
  "jump-loop-still.png",
  "brand/anone-logo-horizontal.svg",
  "brand/anone-logo-horizontal-en.svg",
  "brand/anone-logo-stacked.svg",
  "brand/anone-logo-stacked-en.svg",
  "og.png",
  "og-en.png",
  "og-ko.png",
  "og-zh.png",
] as const;

describe("official assets directory", () => {
  it("lists every excluded file and keeps self-made icons outside it", () => {
    const license = readFileSync(new URL("public/official-assets/LICENSE.md", root), "utf8");
    expect(license).toContain("MIT License");
    expect(license).toContain("ナナツカゼ");
    expect(license).toContain("再許諾");
    expect(license).toContain("fork");
    for (const file of EXCLUDED) {
      expect(license).toContain(`\`${file}\``);
      expect(existsSync(new URL(`public/official-assets/${file}`, root)), file).toBe(true);
    }
    expect(license).toContain("`template/cuts.json`");
    expect(license).toContain("MIT License の対象です");
    expect(existsSync(new URL("public/template", root))).toBe(false);
    expect(existsSync(new URL("public/brand", root))).toBe(false);
    expect(existsSync(new URL("public/og.png", root))).toBe(false);
    expect(existsSync(new URL("public/jump-loop.mp4", root))).toBe(false);
    expect(existsSync(new URL("public/favicon.svg", root))).toBe(true);
    expect(existsSync(new URL("public/icons/icon-192.png", root))).toBe(true);
  });

  it("points the app at the moved public URLs", () => {
    expect(TEMPLATES.portrait.video).toBe("/official-assets/template/landscape.mp4");
    expect(TEMPLATES.portrait.audio).toBe("/official-assets/template/vertical.mp4");
    expect(TEMPLATES.landscape.cuts).toBe("/official-assets/template/landscape-cuts.json");
    expect(JUMP_LOOP_STILL_SRC).toBe("/official-assets/jump-loop-still.png");
    expect(JUMP_LOOP_VIDEO_SRC).toBe("/official-assets/jump-loop.mp4");
    expect(MAKER_LOGO_STACKED_SRC).toBe("/official-assets/brand/anone-logo-stacked.svg");
    expect(OG_IMAGE_URL).toBe("https://anone.yoiailabs.com/official-assets/og.png");
    expect(ogImageUrl("zh")).toBe("https://anone.yoiailabs.com/official-assets/og-zh.png");
    const headers = readFileSync(new URL("public/_headers", root), "utf8");
    expect(headers).toContain("/official-assets/template/*");
    expect(headers).toContain("/official-assets/brand/*");
    expect(headers).not.toMatch(/^\/template\//m);
    expect(headers).not.toMatch(/^\/brand\//m);
  });
});

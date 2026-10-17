import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAKER_LOGO_STACKED_SRC } from "./brand.ts";
import { JUMP_LOOP_STILL_SRC, JUMP_LOOP_VIDEO_SRC } from "./components/JumpLoop.tsx";
import { TEMPLATES } from "./layout.ts";
import { OG_IMAGE_URL, ogImageUrl } from "./page-meta.ts";

const root = new URL("../", import.meta.url);

/** MIT の対象外。public/official-assets/LICENSE.md の表と一致させる。 */
const EXCLUDED = [
  "template/landscape.mp4",
  "jump-loop.mp4",
  "jump-loop-still.png",
] as const;

const MIT_LOGOS = [
  "anone-logo-horizontal.svg",
  "anone-logo-horizontal-en.svg",
  "anone-logo-stacked.svg",
  "anone-logo-stacked-en.svg",
] as const;

const MIT_OG = ["og.png", "og-en.png", "og-ko.png", "og-zh.png"] as const;

describe("official assets directory", () => {
  it("lists only the Nanatsukaze media as excluded and keeps owner-made logos and OG images under MIT", () => {
    const license = readFileSync(new URL("public/official-assets/LICENSE.md", root), "utf8");
    expect(license).toContain("MIT License");
    expect(license).toContain("ナナツカゼ");
    expect(license).toContain("再許諾");
    expect(license).toContain("fork");
    expect(license).not.toContain("ロゴと OGP 画像は MIT");
    expect(license).not.toContain("were made by Yoiailabs");
    for (const file of EXCLUDED) {
      expect(license).toContain(`\`${file}\``);
      expect(existsSync(new URL(`public/official-assets/${file}`, root)), file).toBe(true);
    }
    expect(license).not.toContain("`brand/");
    expect(license).not.toContain("`og.png`");
    expect(license).toContain("`template/landscape-cuts.json`");
    expect(license).not.toContain("`template/cuts.json`");
    expect(license).not.toContain("`template/vertical.mp4`");
    expect(license).toContain("MIT License の対象です");
    expect(existsSync(new URL("public/official-assets/template/cuts.json", root))).toBe(false);
    expect(existsSync(new URL("public/official-assets/template/vertical.mp4", root))).toBe(false);
    expect(existsSync(new URL("public/official-assets/template/landscape-cuts.json", root))).toBe(true);
    for (const file of MIT_LOGOS) {
      expect(existsSync(new URL(`public/brand/${file}`, root)), file).toBe(true);
      expect(existsSync(new URL(`public/official-assets/brand/${file}`, root)), file).toBe(false);
    }
    for (const file of MIT_OG) {
      expect(existsSync(new URL(`public/${file}`, root)), file).toBe(true);
      expect(existsSync(new URL(`public/official-assets/${file}`, root)), file).toBe(false);
    }
    expect(existsSync(new URL("public/template", root))).toBe(false);
    expect(existsSync(new URL("public/jump-loop.mp4", root))).toBe(false);
    expect(existsSync(new URL("public/favicon.svg", root))).toBe(true);
    expect(existsSync(new URL("public/icons/icon-192.png", root))).toBe(true);
  });

  it("points the app at the public URLs", () => {
    expect(TEMPLATES.portrait.video).toBe("/official-assets/template/landscape.mp4");
    expect(TEMPLATES.portrait.audio).toBe(TEMPLATES.portrait.video);
    expect(TEMPLATES.portrait.cuts).toBe("/official-assets/template/landscape-cuts.json");
    expect(TEMPLATES.landscape.cuts).toBe(TEMPLATES.portrait.cuts);
    expect(JUMP_LOOP_STILL_SRC).toBe("/official-assets/jump-loop-still.png");
    expect(JUMP_LOOP_VIDEO_SRC).toBe("/official-assets/jump-loop.mp4");
    expect(MAKER_LOGO_STACKED_SRC).toBe("/brand/anone-logo-stacked.svg");
    expect(OG_IMAGE_URL).toBe("https://anone.yoiailabs.com/og.png");
    expect(ogImageUrl("zh")).toBe("https://anone.yoiailabs.com/og-zh.png");
    const headers = readFileSync(new URL("public/_headers", root), "utf8");
    expect(headers).toContain("/official-assets/template/*");
    expect(headers).toContain("/brand/*");
    expect(headers).not.toContain("/official-assets/brand/");
    expect(headers).not.toMatch(/^\/template\//m);
  });
});

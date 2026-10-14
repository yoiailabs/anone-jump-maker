import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";
import {
  OFFICIAL_LINKS,
  OFFICIAL_MV_EMBED_SRC,
  OFFICIAL_MV_VIDEO_ID,
  OFFICIAL_MV_WATCH_HREF,
} from "./links.ts";
import makerSrc from "./components/MakerApp.tsx?raw";
import embedSrc from "./components/OfficialMvEmbed.tsx?raw";

const stylesSrc = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("official Anone MV embed", () => {
  it("labels the MV in every locale", () => {
    expect(t("ja", "makerOfficialMv")).toBe("「あのね」MV");
    expect(t("en", "makerOfficialMv")).toBe("“Connect the World” MV");
    expect(t("ko", "makerOfficialMv")).toBe("「Connect the World」MV");
    expect(t("zh", "makerOfficialMv")).toBe("「Connect the World」MV");
    expect(t("ja", "makerOfficialMvTitle", { song: t("ja", "songTitle") })).toBe(
      "「あのね」の公式ミュージックビデオ",
    );
    expect(t("en", "makerOfficialMvTitle", { song: t("en", "songTitle") })).toBe(
      "Official music video for Connect the World",
    );
    expect(t("ko", "makerOfficialMvTitle", { song: t("ko", "songTitle") })).toBe(
      "Connect the World 공식 뮤직비디오",
    );
    expect(t("zh", "makerOfficialMvTitle", { song: t("zh", "songTitle") })).toBe("Connect the World 官方音乐视频");
    for (const locale of LOCALES) {
      expect(t(locale, "makerOfficialMv")).toMatch(/MV/);
    }
  });

  it("embeds the official YouTube video on youtube-nocookie", () => {
    expect(OFFICIAL_MV_VIDEO_ID).toBe("M-IayQIR0XA");
    expect(OFFICIAL_MV_WATCH_HREF).toBe("https://www.youtube.com/watch?v=M-IayQIR0XA");
    expect(OFFICIAL_MV_EMBED_SRC).toBe("https://www.youtube-nocookie.com/embed/M-IayQIR0XA");
    expect(embedSrc).toContain("OFFICIAL_MV_EMBED_SRC");
    expect(embedSrc).toContain('loading="lazy"');
    expect(embedSrc).toContain("whenNearViewport");
    expect(embedSrc).toContain("title={title}");
    expect(embedSrc).toContain("allowFullScreen");
  });

  it("sits after the SNS banners and before reactions, without removing JumpLoop", () => {
    expect(makerSrc).toContain("href={JUMP_LOOP_WATCH_HREF}");
    expect(makerSrc).toMatch(/<JumpLoop\b/);
    expect(makerSrc).toMatch(
      /className="link-banners"[^/]*\/>\s*<OfficialMvEmbed\b/,
    );
    expect(makerSrc).toMatch(/<OfficialMvEmbed\b[^/]*\/>\s*<\/nav>/);
    expect(makerSrc).toMatch(/<\/nav>\s*<section className="reactions"/);
    expect(makerSrc).not.toContain('id="fanNote"');
    expect(OFFICIAL_LINKS.map((link) => link.id)).toEqual([
      "x",
      "instagram",
      "youtube",
      "tiktok",
      "spotify",
      "apple-music",
    ]);
    expect(stylesSrc).toMatch(/\.official-mv-frame\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  });
});

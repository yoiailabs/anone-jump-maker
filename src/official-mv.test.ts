import { describe, expect, it } from "vitest";
import { LOCALES, t } from "./i18n.ts";
import {
  OFFICIAL_MV_EMBED_SRC,
  OFFICIAL_MV_VIDEO_ID,
  OFFICIAL_MV_WATCH_HREF,
} from "./links.ts";
import embedSrc from "./components/OfficialMvEmbed.tsx?raw";


describe("official Anone MV embed", () => {
  it("labels the MV in every locale", () => {
    expect(t("ja", "makerOfficialMv")).toBe("「あのね」MV");
    expect(t("en", "makerOfficialMv")).toBe("“Anone” MV");
    expect(t("ko", "makerOfficialMv")).toBe("「あのね」MV");
    expect(t("zh", "makerOfficialMv")).toBe("「あのね」MV");
    expect(t("ja", "makerOfficialMvTitle", { song: t("ja", "songTitle") })).toBe(
      "「あのね」の公式ミュージックビデオ",
    );
    expect(t("en", "makerOfficialMvTitle", { song: t("en", "songTitle") })).toBe(
      "Official music video for Anone(Connect the World)",
    );
    expect(t("ko", "makerOfficialMvTitle", { song: t("ko", "songTitle") })).toContain("공식 뮤직비디오");
    expect(t("zh", "makerOfficialMvTitle", { song: t("zh", "songTitle") })).toContain("官方音乐视频");
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


});

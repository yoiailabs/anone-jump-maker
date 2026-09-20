import { describe, expect, it } from "vitest";
import { linkBannersHtml, OFFICIAL_LINKS, OFFICIAL_MV_WATCH_HREF } from "./links.ts";

describe("official link banners", () => {
  it("covers the official SNS and streaming services once each", () => {
    expect(OFFICIAL_LINKS.map((link) => link.id)).toEqual([
      "x",
      "instagram",
      "youtube",
      "tiktok",
      "spotify",
      "apple-music",
    ]);
    expect(OFFICIAL_LINKS.find((link) => link.id === "instagram")?.href).toBe(
      "https://www.instagram.com/nanatsukaze_/",
    );
    expect(OFFICIAL_LINKS.find((link) => link.id === "tiktok")?.href).toBe(
      "https://www.tiktok.com/@nanatsukaze_ofc",
    );
  });

  it("points at https URLs only", () => {
    for (const link of OFFICIAL_LINKS) {
      expect(link.href.startsWith("https://")).toBe(true);
    }
  });

  it("opens every banner in a new tab without leaking the referrer window", () => {
    const html = linkBannersHtml();
    for (const link of OFFICIAL_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`data-service="${link.id}"`);
    }
    expect(html.match(/target="_blank"/g)).toHaveLength(OFFICIAL_LINKS.length);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(OFFICIAL_LINKS.length);
    expect(html).toContain(`aria-label="ナナツカゼさんのXを開く（新しいタブ）"`);
    expect(linkBannersHtml(undefined, "en")).toContain("Open Nanatsukaze");
    expect(linkBannersHtml(undefined, "ko")).toContain("Nanatsukaze의 X 열기");
    expect(linkBannersHtml(undefined, "zh")).toContain("打开 Nanatsukaze 的X");
    expect(linkBannersHtml(OFFICIAL_LINKS.slice(0, 1), "ja", "communityHashtagSearchAria")).toContain(
      "Xで #あのねジャンプ を検索する（新しいタブ）",
    );
  });

  it("shares the official MV watch URL with the JumpLoop", () => {
    expect(OFFICIAL_MV_WATCH_HREF).toBe("https://www.youtube.com/watch?v=M-IayQIR0XA");
  });
});

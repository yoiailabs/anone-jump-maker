import { describe, expect, it } from "vitest";
import {
  JUMP_LOOP_WATCH_HREF,
  linkBannersHtml,
  OFFICIAL_LINKS,
  OFFICIAL_MV_WATCH_HREF,
  youtubePlaybackUrl,
} from "./links.ts";

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

  it("keeps the official MV watch URL without a start time", () => {
    expect(OFFICIAL_MV_WATCH_HREF).toBe("https://www.youtube.com/watch?v=M-IayQIR0XA");
  });
});

describe("youtube playback url", () => {
  it("starts a watch URL at 60 seconds and keeps existing query params", () => {
    expect(youtubePlaybackUrl("https://www.youtube.com/watch?v=M-IayQIR0XA", 60)).toBe(
      "https://www.youtube.com/watch?v=M-IayQIR0XA&t=60s",
    );
    expect(youtubePlaybackUrl("https://youtube.com/watch?v=M-IayQIR0XA&list=PLabc&index=2", 60)).toBe(
      "https://youtube.com/watch?v=M-IayQIR0XA&list=PLabc&index=2&t=60s",
    );
    expect(youtubePlaybackUrl("https://m.youtube.com/watch?v=M-IayQIR0XA&feature=share", 60)).toBe(
      "https://m.youtube.com/watch?v=M-IayQIR0XA&feature=share&t=60s",
    );
  });

  it("starts a youtu.be URL at 60 seconds and keeps existing query params", () => {
    expect(youtubePlaybackUrl("https://youtu.be/M-IayQIR0XA", 60)).toBe("https://youtu.be/M-IayQIR0XA?t=60");
    expect(youtubePlaybackUrl("https://www.youtu.be/M-IayQIR0XA?si=sharetoken", 60)).toBe(
      "https://www.youtu.be/M-IayQIR0XA?si=sharetoken&t=60",
    );
  });

  it("leaves encoded query values untouched", () => {
    expect(
      youtubePlaybackUrl("https://www.youtube.com/watch?v=abc&list=PL%2Fabc%3D&q=a+b&q=c%20d", 60),
    ).toBe("https://www.youtube.com/watch?v=abc&list=PL%2Fabc%3D&q=a+b&q=c%20d&t=60s");
  });

  it("replaces an existing start time and keeps the fragment", () => {
    expect(youtubePlaybackUrl("https://www.youtube.com/watch?v=M-IayQIR0XA&t=10s&list=PLabc#comments", 60)).toBe(
      "https://www.youtube.com/watch?v=M-IayQIR0XA&t=60s&list=PLabc#comments",
    );
    expect(youtubePlaybackUrl("https://youtu.be/M-IayQIR0XA?t=12&si=sharetoken#clip", 60)).toBe(
      "https://youtu.be/M-IayQIR0XA?t=60&si=sharetoken#clip",
    );
    expect(youtubePlaybackUrl("https://www.youtube.com/watch?v=abc&t=1&list=PL&t=2", 60)).toBe(
      "https://www.youtube.com/watch?v=abc&t=60s&list=PL",
    );
  });

  it("points the JumpLoop at the official MV from 1:00", () => {
    expect(JUMP_LOOP_WATCH_HREF).toBe("https://www.youtube.com/watch?v=M-IayQIR0XA&t=60s");
  });
});

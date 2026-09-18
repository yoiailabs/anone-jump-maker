import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateReactionEmbed, reactionEmbedHtml, REACTION_POSTS } from "./reactions.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reaction embeds", () => {
  it("lists the official Nanatsukaze post first, then PIKASONIC", () => {
    expect(REACTION_POSTS.map((post) => post.id)).toEqual([
      "2100840133016912147",
      "2100570924915548571",
    ]);
    expect(REACTION_POSTS[0]?.href).toBe(
      "https://x.com/Nanatsukaze_ofc/status/2100840133016912147",
    );
    expect(REACTION_POSTS[1]?.href).toBe(
      "https://x.com/PIKASONIC_ofc/status/2100570924915548571",
    );
  });

  it("embeds Nanatsukaze above PIKASONIC in the HTML", () => {
    const html = reactionEmbedHtml();
    const nanatsukaze = html.indexOf("2100840133016912147");
    const pikasonic = html.indexOf("2100570924915548571");
    expect(nanatsukaze).toBeGreaterThan(-1);
    expect(pikasonic).toBeGreaterThan(nanatsukaze);
    expect(html).toContain("@Nanatsukaze_ofc");
    expect(html).toContain("ナナツカゼ");
    expect(html).toContain("簡単に作れるようになったﾆｬ!");
    expect(html).toContain("pic.twitter.com/ONLDedNFIH");
    expect(html).toContain("2026年9月18日");
  });

  it("keeps the PIKASONIC post from the official URL", () => {
    const html = reactionEmbedHtml();
    expect(html).toContain(`href="${REACTION_POSTS[1]?.href}?ref_src=twsrc%5Etfw"`);
    expect(html).toContain("おおおお簡単に作れた！！すげぇ！！");
    expect(html).toContain("@PIKASONIC_ofc");
    expect(html).toContain("2026年9月17日");
  });

  it("renders official twitter-tweet blockquotes for widgets.js", () => {
    const html = reactionEmbedHtml();
    expect(html.match(/class="twitter-tweet"/g)).toHaveLength(REACTION_POSTS.length);
    expect(html).toContain('data-dnt="true"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain("#あのねジャンプ");
    expect(html).toContain("#あのねジャンプメーカー");
  });

  it("loads widgets once for the whole container", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const container = { id: "reactionsEmbed" } as HTMLElement;
    vi.stubGlobal("window", { twttr: { widgets: { load } } });
    hydrateReactionEmbed(container);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(container);
  });
});

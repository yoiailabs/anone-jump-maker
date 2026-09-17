import { describe, expect, it } from "vitest";
import { reactionEmbedHtml, REACTION_POST } from "./reactions.ts";

describe("reaction embed", () => {
  it("embeds the PIKASONIC post from the official URL", () => {
    const html = reactionEmbedHtml();
    expect(REACTION_POST.href).toBe("https://x.com/PIKASONIC_ofc/status/2100570924915548571");
    expect(html).toContain(`href="${REACTION_POST.href}?ref_src=twsrc%5Etfw"`);
    expect(html).toContain('class="twitter-tweet"');
    expect(html).toContain('data-dnt="true"');
    expect(html).toContain("おおおお簡単に作れた！！すげぇ！！");
    expect(html).toContain("@PIKASONIC_ofc");
  });

  it("keeps a readable fallback that still opens the original post", () => {
    const html = reactionEmbedHtml();
    expect(html).toContain("#あのねジャンプ");
    expect(html).toContain("#あのねジャンプメーカー");
    expect(html).toContain("2026年9月17日");
  });
});

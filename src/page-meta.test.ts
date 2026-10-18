import { describe, expect, it } from "vitest";
import { OG_IMAGE_URL, ogImageUrl, pageMeta } from "./page-meta.ts";

describe("locale page meta", () => {
  it("uses a per-locale OG image and Open Graph locale", () => {
    expect(ogImageUrl("ja")).toBe(OG_IMAGE_URL);
    expect(ogImageUrl("en")).toBe("https://anone.yoiailabs.com/og-en.png");
    expect(pageMeta("en", "maker").ogLocale).toBe("en_US");
    expect(pageMeta("en", "maker").siteName).toBe("Anone Jump Maker");
    expect(pageMeta("ko", "maker").image).toBe("https://anone.yoiailabs.com/og-ko.png");
    expect(pageMeta("zh", "maker").url).toBe("https://anone.yoiailabs.com/zh");
    expect(pageMeta("ja", "privacy").title).toBe("プライバシーポリシー");
    expect(pageMeta("ja", "privacy").url).toBe("https://anone.yoiailabs.com/privacy");
    expect(pageMeta("en", "privacy").url).toBe("https://anone.yoiailabs.com/privacy");
    expect(pageMeta("en", "privacy").title).toBe("プライバシーポリシー");
    expect(pageMeta("en", "privacy").lang).toBe("ja");
    expect(pageMeta("en", "privacy").siteName).toBe("あのねジャンプメーカー");
    expect(pageMeta("ja", "terms").title).toBe("利用規約");
    expect(pageMeta("ja", "terms").url).toBe("https://anone.yoiailabs.com/terms");
    expect(pageMeta("ko", "terms").url).toBe("https://anone.yoiailabs.com/terms");
  });
});

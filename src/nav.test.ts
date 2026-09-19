import { describe, expect, it } from "vitest";
import {
  documentTitleForView,
  hashForView,
  MAKER_DOCUMENT_TITLE,
  parseAppView,
  TO_COMMUNITY_LABEL,
  TO_MAKER_LABEL,
  toCommunityLinkHtml,
  toMakerLinkHtml,
} from "./nav.ts";

describe("app view hash", () => {
  it("treats empty and #maker as the maker, #community as the community page", () => {
    expect(parseAppView("")).toBe("maker");
    expect(parseAppView("#")).toBe("maker");
    expect(parseAppView("#maker")).toBe("maker");
    expect(parseAppView("#/maker")).toBe("maker");
    expect(parseAppView("#community")).toBe("community");
    expect(parseAppView("#/community")).toBe("community");
    expect(parseAppView("#nope")).toBe("maker");
  });

  it("writes stable hashes and titles", () => {
    expect(hashForView("maker")).toBe("#maker");
    expect(hashForView("community")).toBe("#community");
    expect(documentTitleForView("maker", "みんなの #あのねジャンプ")).toBe(MAKER_DOCUMENT_TITLE);
    expect(documentTitleForView("community", "みんなの #あのねジャンプ")).toBe("みんなの #あのねジャンプ");
  });

  it("renders Japanese in-site links to the hashes", () => {
    const toCommunity = toCommunityLinkHtml();
    const toMaker = toMakerLinkHtml();
    expect(toCommunity).toContain(TO_COMMUNITY_LABEL);
    expect(toCommunity).toContain('href="#community"');
    expect(toCommunity).toContain('id="toCommunity"');
    expect(toCommunity).not.toContain("app-tab");
    expect(toMaker).toContain(TO_MAKER_LABEL);
    expect(toMaker).toContain('href="#maker"');
    expect(toMaker).toContain('id="toMaker"');
    expect(toMaker).not.toContain("app-tab");
  });
});

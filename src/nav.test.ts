import { describe, expect, it } from "vitest";
import {
  appViewFromClick,
  canonicalAppUrl,
  documentTitleForView,
  MAKER_DOCUMENT_TITLE,
  parseAppView,
  pathForView,
  TO_COMMUNITY_LABEL,
  TO_MAKER_LABEL,
  toCommunityLinkHtml,
  toMakerLinkHtml,
} from "./nav.ts";

describe("app view path", () => {
  it("treats / and leftover hashes as the maker, /community as the community page", () => {
    expect(parseAppView("/")).toBe("maker");
    expect(parseAppView("/?bench=1")).toBe("maker");
    expect(parseAppView("/make")).toBe("studio");
    expect(parseAppView("/en/make")).toBe("studio");
    expect(parseAppView("/community")).toBe("community");
    expect(parseAppView("/community/")).toBe("community");
    expect(parseAppView("/community?from=x")).toBe("community");
    expect(parseAppView("")).toBe("maker");
    expect(parseAppView("#")).toBe("maker");
    expect(parseAppView("#maker")).toBe("maker");
    expect(parseAppView("#community")).toBe("community");
    expect(parseAppView("#/community")).toBe("community");
    expect(parseAppView({ pathname: "/", hash: "" })).toBe("maker");
    expect(parseAppView({ pathname: "/", hash: "#community" })).toBe("community");
    expect(parseAppView({ pathname: "/community", hash: "" })).toBe("community");
    expect(parseAppView({ pathname: "/nope", hash: "" })).toBe("maker");
    expect(parseAppView("/en")).toBe("maker");
    expect(parseAppView("/en/community")).toBe("community");
    expect(parseAppView("/ko/community/")).toBe("community");
    expect(parseAppView("/privacy")).toBe("privacy");
    expect(parseAppView("/en/privacy")).toBe("privacy");
    expect(parseAppView("/terms")).toBe("terms");
    expect(parseAppView("/zh/terms")).toBe("terms");
    expect(parseAppView({ pathname: "/en", hash: "#community" })).toBe("community");
  });

  it("writes stable paths and titles", () => {
    expect(pathForView("maker")).toBe("/");
    expect(pathForView("studio")).toBe("/make");
    expect(pathForView("studio", "zh")).toBe("/zh/make");
    expect(pathForView("community")).toBe("/community");
    expect(pathForView("maker", "en")).toBe("/en");
    expect(pathForView("community", "ko")).toBe("/ko/community");
    expect(pathForView("privacy")).toBe("/privacy");
    expect(pathForView("privacy", "ko")).toBe("/privacy");
    expect(pathForView("terms")).toBe("/terms");
    expect(pathForView("terms", "en")).toBe("/terms");
    expect(documentTitleForView("maker")).toBe(MAKER_DOCUMENT_TITLE);
    expect(documentTitleForView("community")).toBe("みんなの #あのねジャンプ");
    expect(documentTitleForView("privacy")).toBe("プライバシーポリシー");
    expect(documentTitleForView("terms")).toBe("利用規約");
    expect(documentTitleForView("maker", "en")).toBe("Anone Jump Maker");
  });

  it("canonicalizes leftover hashes onto the real path and keeps the query", () => {
    expect(canonicalAppUrl({ pathname: "/", search: "", hash: "" })).toBeNull();
    expect(canonicalAppUrl({ pathname: "/community", search: "", hash: "" })).toBeNull();
    expect(canonicalAppUrl({ pathname: "/", search: "", hash: "#community" })).toBe("/community");
    expect(canonicalAppUrl({ pathname: "/", search: "?bench=1", hash: "#community" })).toBe(
      "/community?bench=1",
    );
    expect(canonicalAppUrl({ pathname: "/", search: "?bench=1", hash: "#maker" })).toBe("/?bench=1");
    expect(canonicalAppUrl({ pathname: "/community", search: "?bench=1", hash: "" })).toBeNull();
    expect(canonicalAppUrl({ pathname: "/en", search: "", hash: "#community" })).toBe("/en/community");
    expect(canonicalAppUrl({ pathname: "/ja", search: "", hash: "" })).toBe("/");
    expect(canonicalAppUrl({ pathname: "/en/", search: "", hash: "" })).toBe("/en");
    expect(canonicalAppUrl({ pathname: "/privacy", search: "", hash: "" })).toBeNull();
    expect(canonicalAppUrl({ pathname: "/ja/privacy", search: "", hash: "" })).toBe("/privacy");
    expect(canonicalAppUrl({ pathname: "/terms", search: "", hash: "" })).toBeNull();
    expect(canonicalAppUrl({ pathname: "/ja/terms", search: "", hash: "" })).toBe("/terms");
  });

  it("renders Japanese in-site links to the real paths", () => {
    const toCommunity = toCommunityLinkHtml();
    const toMaker = toMakerLinkHtml();
    expect(toCommunity).toContain(TO_COMMUNITY_LABEL);
    expect(toCommunity).toContain('href="https://x.com/search?q=');
    expect(toCommunity).toContain('target="_blank"');
    expect(toCommunity).toContain('rel="noopener noreferrer"');
    expect(toCommunity).not.toContain('href="/community"');
    expect(toCommunity).toContain('id="toCommunity"');
    expect(toCommunity).toContain('class="btn"');
    expect(toCommunity).not.toContain("#community");
    expect(toCommunity).not.toContain("app-tab");
    expect(toMaker).toContain(TO_MAKER_LABEL);
    expect(toMaker).toContain('href="/"');
    expect(toMaker).toContain('id="toMaker"');
    expect(toMaker).toContain('class="page-link"');
    expect(toMaker).not.toContain("#maker");
    expect(toMaker).not.toContain("btn");
    expect(toMakerLinkHtml("toMakerBottom")).toContain('id="toMakerBottom"');
  });

  it("treats same-origin maker/community anchors as in-site views", () => {
    const origin = "https://anone.yoiailabs.com";
    expect(appViewFromClick({ href: `${origin}/community`, target: "" }, origin)).toBe("community");
    expect(appViewFromClick({ href: `${origin}/`, target: "" }, origin)).toBe("maker");
    expect(appViewFromClick({ href: `${origin}/en/community`, target: "" }, origin)).toBe("community");
    expect(appViewFromClick({ href: `${origin}/zh`, target: "" }, origin)).toBe("maker");
    expect(appViewFromClick({ href: `${origin}/privacy`, target: "" }, origin)).toBe("privacy");
    expect(appViewFromClick({ href: `${origin}/en/privacy`, target: "" }, origin)).toBe("privacy");
    expect(appViewFromClick({ href: `${origin}/terms`, target: "" }, origin)).toBe("terms");
    expect(appViewFromClick({ href: `${origin}/en/terms`, target: "" }, origin)).toBe("terms");
    expect(appViewFromClick({ href: `${origin}/community`, target: "_blank" }, origin)).toBeNull();
    expect(
      appViewFromClick({ href: "https://x.com/search?q=%23test", target: "_blank" }, origin),
    ).toBeNull();
  });
});

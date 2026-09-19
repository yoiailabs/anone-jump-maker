import { describe, expect, it } from "vitest";
import {
  appTabsHtml,
  documentTitleForView,
  hashForView,
  MAKER_DOCUMENT_TITLE,
  parseAppView,
  syncAppTabs,
  TAB_COMMUNITY_LABEL,
  TAB_MAKER_LABEL,
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

  it("renders Japanese top tabs that point at the hashes", () => {
    const html = appTabsHtml();
    expect(html).toContain(TAB_MAKER_LABEL);
    expect(html).toContain(TAB_COMMUNITY_LABEL);
    expect(html).toContain('href="#maker"');
    expect(html).toContain('href="#community"');
    expect(html).toContain('id="tabMaker"');
    expect(html).toContain('id="tabCommunity"');
  });

  it("marks the active tab with aria-current", () => {
    const attrs = new Map<string, string>();
    const el = (id: string) => ({
      setAttribute(name: string, value: string) {
        attrs.set(`${id}:${name}`, value);
      },
    });
    const root = {
      querySelector(sel: string) {
        if (sel === "#tabMaker") return el("maker");
        if (sel === "#tabCommunity") return el("community");
        return null;
      },
    };
    syncAppTabs(root as unknown as ParentNode, "community");
    expect(attrs.get("maker:aria-current")).toBe("false");
    expect(attrs.get("community:aria-current")).toBe("page");
  });
});

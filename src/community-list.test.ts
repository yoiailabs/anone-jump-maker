import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMPS_EMPTY,
  COMMUNITY_JUMPS_LEDE,
  COMMUNITY_JUMPS_TITLE,
  MORE_JUMPS_HREF,
  MORE_JUMPS_LABEL,
  communityJumpsSectionHtml,
  hydrateIndexes,
  rememberHydrateIndexes,
  shouldHydrateRemaining,
  visibleLogicalIndexes,
} from "./community-list.ts";
import { COMMUNITY_JUMP_POSTS, type CommunityJumpPost } from "./community-jumps.ts";

describe("community list hydrate window", () => {
  it("hydrates intersecting cards plus one neighbor above and below", () => {
    expect(hydrateIndexes([0], 10)).toEqual([0, 1]);
    expect(hydrateIndexes([4], 10)).toEqual([3, 4, 5]);
    expect(hydrateIndexes([9], 10)).toEqual([8, 9]);
    expect(hydrateIndexes([0, 1], 10)).toEqual([0, 1, 2]);
    expect(hydrateIndexes([], 10)).toEqual([]);
    expect(hydrateIndexes([0], 1)).toEqual([0]);
    expect(hydrateIndexes([2], 0)).toEqual([]);
  });

  it("keeps earlier cards after later ones enter view", () => {
    expect(rememberHydrateIndexes([0, 1], [4], 10)).toEqual([0, 1, 3, 4, 5]);
    expect(rememberHydrateIndexes([0, 1, 2], [], 10)).toEqual([0, 1, 2]);
    expect(rememberHydrateIndexes([], [8, 9], 10)).toEqual([7, 8, 9]);
  });

  it("treats cards overlapping the padded viewport as visible", () => {
    const items = [0, 1, 2, 3].map((logical) => ({
      dataset: { logical: String(logical) },
      getBoundingClientRect: () => ({
        top: logical * 400 - 100,
        bottom: logical * 400 + 200,
        width: 320,
        height: 300,
      }),
    }));
    expect(visibleLogicalIndexes(items, 700, 160)).toEqual([0, 1, 2]);
    expect(visibleLogicalIndexes(items, 200, 0)).toEqual([0]);
  });

  it("hydrates the rest of the list once the bottom is near the viewport", () => {
    expect(shouldHydrateRemaining({ bottom: 900, height: 2000, width: 320 }, 800, 160)).toBe(true);
    expect(shouldHydrateRemaining({ bottom: 2000, height: 2000, width: 320 }, 800, 160)).toBe(false);
    expect(shouldHydrateRemaining({ bottom: 0, height: 0, width: 0 }, 800, 160)).toBe(false);
  });
});

describe("community list markup", () => {
  it("stacks one item per curated post with no carousel chrome", () => {
    const html = communityJumpsSectionHtml();
    expect(html).toContain(COMMUNITY_JUMPS_TITLE);
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain('id="communityJumps"');
    expect(html).toContain('id="communityJumpsList"');
    expect(html).toContain('id="toMaker"');
    expect(html).toContain('id="toMakerBottom"');
    expect(html).toContain('href="/"');
    expect(html).toContain('class="page-link"');
    expect(html).not.toContain("btn ghost");
    expect(html).toContain("メーカーに戻る");
    expect(html).toContain(MORE_JUMPS_LABEL);
    expect(html).toContain('id="moreJumps"');
    expect(html).toContain('class="btn community-more-btn"');
    expect(html).toContain(`href="${MORE_JUMPS_HREF}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(MORE_JUMPS_HREF).toBe(`https://x.com/search?q=${encodeURIComponent("#あのねジャンプ")}`);
    expect(html.match(/id="toMaker"/g)).toHaveLength(1);
    expect(html.match(/メーカーに戻る/g)).toHaveLength(2);
    expect(html.match(/id="moreJumps"/g)).toHaveLength(1);
    expect(html.indexOf("toMaker")).toBeLessThan(html.indexOf("communityJumpsList"));
    expect(html.indexOf("communityJumpsList")).toBeLessThan(html.indexOf("moreJumps"));
    expect(html.indexOf("moreJumps")).toBeLessThan(html.indexOf("toMakerBottom"));
    expect(html).not.toContain("app-tab");
    expect(html).not.toContain("communityJumpsPrev");
    expect(html).not.toContain("communityJumpsNext");
    expect(html).not.toContain("communityJumpsMeter");
    expect(html).not.toContain("community-jumps-track");
    expect(html).not.toContain("community-jumps-viewport");
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(10);
    expect(html.match(/data-post-id="2100797924125049167"/g)).toHaveLength(1);
    expect(html.match(/data-post-id="2100886138257121546"/g)).toHaveLength(1);
    expect(html).toContain("@02_ZERO_Ni");
    expect(html).toContain("738 いいね");
    expect(html).toContain("@_nakotanmaru");
    expect(html).toContain('href="https://x.com/_nakotanmaru/status/2100880092864122959"');
    expect(html.indexOf("2100797924125049167")).toBeLessThan(html.indexOf("2100886138257121546"));
  });

  it("shows an empty state and no list when the posts are swapped to empty", () => {
    const empty: readonly CommunityJumpPost[] = [];
    const html = communityJumpsSectionHtml(empty);
    expect(html).toContain(COMMUNITY_JUMPS_EMPTY);
    expect(html).toContain(COMMUNITY_JUMPS_TITLE);
    expect(html).toContain('id="toMakerBottom"');
    expect(html).toContain('id="moreJumps"');
    expect(html).not.toContain("community-jumps-list");
    expect(html).not.toContain(COMMUNITY_JUMPS_LEDE);
  });

  it("keeps a single stacked item when only one post remains", () => {
    const html = communityJumpsSectionHtml(COMMUNITY_JUMP_POSTS.slice(0, 1));
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(1);
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
  });
});

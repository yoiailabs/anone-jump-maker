import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMPS_EMPTY,
  COMMUNITY_JUMPS_LEDE,
  COMMUNITY_JUMPS_TITLE,
  COMMUNITY_MASONRY_BREAKPOINTS,
  COMMUNITY_MASONRY_GAP_PX,
  COMMUNITY_MASONRY_ROW_PX,
  MORE_JUMPS_HREF,
  MORE_JUMPS_LABEL,
  applyCommunityMasonryItem,
  applyCommunityMasonryLayout,
  communityJumpsSectionHtml,
  communityMasonryColumns,
  communityMasonryRowSpan,
  hydrateIndexes,
  hydratePadForColumns,
  refreshCommunityJumps,
  rememberHydrateIndexes,
  shouldHydrateRemaining,
  visibleLogicalIndexes,
} from "./community-list.ts";
import {
  COMMUNITY_JUMP_CAPACITY,
  COMMUNITY_JUMP_POSTS,
  communityJumpFromHref,
  type CommunityJumpPost,
} from "./community-jumps.ts";

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

  it("no-ops refresh when the list was never mounted", () => {
    expect(() => refreshCommunityJumps({} as HTMLElement)).not.toThrow();
  });
});

describe("community masonry", () => {
  it("uses 1 / 2 / 3 columns at the community page breakpoints", () => {
    expect(COMMUNITY_MASONRY_BREAKPOINTS).toEqual({ tablet: 640, desktop: 1024 });
    expect(communityMasonryColumns(390)).toBe(1);
    expect(communityMasonryColumns(639)).toBe(1);
    expect(communityMasonryColumns(640)).toBe(2);
    expect(communityMasonryColumns(1023)).toBe(2);
    expect(communityMasonryColumns(1024)).toBe(3);
    expect(communityMasonryColumns(1280)).toBe(3);
    expect(communityMasonryColumns(Number.NaN)).toBe(1);
    expect(hydratePadForColumns(1)).toBe(1);
    expect(hydratePadForColumns(2)).toBe(2);
    expect(hydratePadForColumns(3)).toBe(3);
    expect(hydratePadForColumns(0)).toBe(1);
    expect(hydrateIndexes([0], 10, hydratePadForColumns(3))).toEqual([0, 1, 2, 3]);
  });

  it("maps card height onto grid row spans with the same row and gap as CSS", () => {
    expect(COMMUNITY_MASONRY_ROW_PX).toBe(8);
    expect(COMMUNITY_MASONRY_GAP_PX).toBe(18);
    expect(communityMasonryRowSpan(8)).toBe(1);
    expect(communityMasonryRowSpan(9)).toBe(2);
    expect(communityMasonryRowSpan(416)).toBe(17);
    expect(communityMasonryRowSpan(192)).toBe(9);
    expect(communityMasonryRowSpan(0)).toBe(1);
    expect(communityMasonryRowSpan(-4)).toBe(1);
  });

  it("clears spans in one column and writes them from card height in three", () => {
    const card = { offsetHeight: 416 };
    const item = {
      style: { gridRowEnd: "span 9" },
      querySelector: () => card,
      offsetHeight: 416,
    } as unknown as HTMLElement;
    applyCommunityMasonryItem(item, 1);
    expect(item.style.gridRowEnd).toBe("");
    applyCommunityMasonryItem(item, 3);
    expect(item.style.gridRowEnd).toBe("span 17");

    const list = {
      dataset: {} as Record<string, string>,
      style: { setProperty: (name: string, value: string) => {
        list.dataset[name] = value;
      }},
    } as unknown as HTMLElement;
    applyCommunityMasonryLayout(list, [item], 2);
    expect(list.dataset.masonryCols).toBe("2");
  });
});

describe("community list markup", () => {
  it("lays out one masonry item per curated post with no carousel chrome", () => {
    const html = communityJumpsSectionHtml();
    expect(html).toContain(COMMUNITY_JUMPS_TITLE);
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain('id="communityJumps"');
    expect(html).toContain('id="communityJumpsList"');
    expect(html).toContain("community-jumps-masonry");
    expect(html).toContain('data-media="video"');
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
    expect(html).toContain('class="lang-switch"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="/en/community"');
    expect(html).not.toContain("app-tab");
    expect(html).not.toContain("communityJumpsPrev");
    expect(html).not.toContain("communityJumpsNext");
    expect(html).not.toContain("communityJumpsMeter");
    expect(html).not.toContain("community-jumps-track");
    expect(html).not.toContain("community-jumps-viewport");
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(10);
    expect(html.match(/data-media="video"/g)).toHaveLength(10);
    expect(html.match(/data-post-id="2100797924125049167"/g)).toHaveLength(1);
    expect(html.match(/data-post-id="2100886138257121546"/g)).toHaveLength(1);
    expect(html).toContain("@02_ZERO_Ni");
    expect(html).toContain("738 いいね");
    expect(html).toContain("@_nakotanmaru");
    expect(html).toContain('href="https://x.com/_nakotanmaru/status/2100880092864122959"');
    expect(html.indexOf("2100797924125049167")).toBeLessThan(html.indexOf("2100886138257121546"));
  });

  it("keeps a 30-post list in the same masonry markup so new curated rows are drop-in", () => {
    const posts = Array.from({ length: COMMUNITY_JUMP_CAPACITY }, (_, index) =>
      communityJumpFromHref(`https://x.com/user${index}/status/${2_100_000_000_000_000 + index}`, index + 1),
    );
    const html = communityJumpsSectionHtml(posts);
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(30);
    expect(html).toContain("community-jumps-masonry");
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).not.toContain("community-jumps-track");
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

  it("keeps a single masonry item when only one post remains", () => {
    const html = communityJumpsSectionHtml(COMMUNITY_JUMP_POSTS.slice(0, 1));
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(1);
    expect(html).toContain("community-jumps-masonry");
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
  });
});

import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMPS_EMPTY,
  COMMUNITY_JUMPS_LEDE,
  COMMUNITY_JUMPS_TITLE,
  MORE_JUMPS_HREF,
  MORE_JUMPS_LABEL,
  communityJumpsSectionHtml,
  hydrateIndexes,
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
    expect(html).toContain('href="#maker"');
    expect(html).toContain('class="page-link"');
    expect(html).not.toContain("btn ghost");
    expect(html).toContain("メーカーに戻る");
    expect(html).toContain(MORE_JUMPS_LABEL);
    expect(html).toContain('id="moreJumps"');
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

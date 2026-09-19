import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMPS_EMPTY,
  COMMUNITY_JUMPS_LEDE,
  COMMUNITY_JUMPS_TITLE,
  communityJumpsSectionHtml,
  logicalFromVisual,
  loopingCarousel,
  meterLabel,
  neighborIndexes,
  shouldHydrateSlide,
  snapLoopVisual,
  startVisual,
  wrapIndex,
} from "./community-carousel.ts";
import { COMMUNITY_JUMP_POSTS, type CommunityJumpPost } from "./community-jumps.ts";

function uniqueHydratedLogicals(currentLogical: number, length: number): number[] {
  const visuals = loopingCarousel(length) ? length + 2 : length;
  const logicals = new Set<number>();
  for (let visual = 0; visual < visuals; visual += 1) {
    if (shouldHydrateSlide(visual, currentLogical, length)) {
      logicals.add(logicalFromVisual(visual, length));
    }
  }
  return [...logicals].sort((a, b) => a - b);
}

describe("community carousel math", () => {
  it("wraps indexes in both directions", () => {
    expect(wrapIndex(0, 10)).toBe(0);
    expect(wrapIndex(10, 10)).toBe(0);
    expect(wrapIndex(-1, 10)).toBe(9);
    expect(wrapIndex(21, 10)).toBe(1);
  });

  it("names current ±1 neighbors and both items when there are only two", () => {
    expect(neighborIndexes(0, 10)).toEqual([9, 0, 1]);
    expect(neighborIndexes(9, 10)).toEqual([8, 9, 0]);
    expect(neighborIndexes(4, 10)).toEqual([3, 4, 5]);
    expect(neighborIndexes(0, 2)).toEqual([1, 0]);
    expect(neighborIndexes(0, 1)).toEqual([0]);
    expect(neighborIndexes(0, 0)).toEqual([]);
  });

  it("maps clone visuals onto the first and last posts", () => {
    expect(startVisual(10)).toBe(1);
    expect(logicalFromVisual(0, 10)).toBe(9);
    expect(logicalFromVisual(1, 10)).toBe(0);
    expect(logicalFromVisual(10, 10)).toBe(9);
    expect(logicalFromVisual(11, 10)).toBe(0);
    expect(snapLoopVisual(0, 10)).toBe(10);
    expect(snapLoopVisual(11, 10)).toBe(1);
    expect(snapLoopVisual(4, 10)).toBe(4);
    expect(meterLabel(0, 10)).toBe("1 / 10");
    expect(meterLabel(9, 10)).toBe("10 / 10");
  });

  it("hydrates only the current post and its ±1 neighbors (unique)", () => {
    for (let logical = 0; logical < 10; logical += 1) {
      expect(uniqueHydratedLogicals(logical, 10)).toEqual(
        [...neighborIndexes(logical, 10)].sort((a, b) => a - b),
      );
      expect(uniqueHydratedLogicals(logical, 10)).toHaveLength(3);
    }
    expect(shouldHydrateSlide(3, 0, 10)).toBe(false);
    expect(shouldHydrateSlide(0, 0, 10)).toBe(true);
    expect(shouldHydrateSlide(11, 0, 10)).toBe(true);
    expect(shouldHydrateSlide(1, 5, 10)).toBe(false);
    expect(shouldHydrateSlide(0, 0, 1)).toBe(true);
  });
});

describe("community carousel markup", () => {
  it("renders the Japanese section with loop clones around the curated 10", () => {
    const html = communityJumpsSectionHtml();
    expect(html).toContain(COMMUNITY_JUMPS_TITLE);
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain('id="communityJumps"');
    expect(html).toContain("aria-label=\"前の動画\"");
    expect(html).toContain("aria-label=\"次の動画\"");
    expect(html).toContain("1 / 10");
    expect(html.match(/class="community-jumps-slide"/g)).toHaveLength(12);
    expect(html.match(/data-post-id="2100797924125049167"/g)).toHaveLength(2);
    expect(html.match(/data-post-id="2100886138257121546"/g)).toHaveLength(2);
    expect(html).toContain("@02_ZERO_Ni");
    expect(html).toContain("738 いいね");
    expect(html).toContain("@_nakotanmaru");
    expect(html).toContain('href="https://x.com/_nakotanmaru/status/2100880092864122959"');
    const firstBody = html.indexOf('data-visual="1"');
    const secondBody = html.indexOf('data-visual="2"');
    expect(html.slice(firstBody, secondBody)).toContain("2100797924125049167");
    expect(html.slice(secondBody)).toContain("2100880092864122959");
  });

  it("shows an empty state and no track when the list is swapped to empty", () => {
    const empty: readonly CommunityJumpPost[] = [];
    const html = communityJumpsSectionHtml(empty);
    expect(html).toContain(COMMUNITY_JUMPS_EMPTY);
    expect(html).not.toContain("community-jumps-track");
    expect(html).not.toContain(COMMUNITY_JUMPS_LEDE);
  });

  it("skips loop clones when only one post remains", () => {
    const html = communityJumpsSectionHtml(COMMUNITY_JUMP_POSTS.slice(0, 1));
    expect(html.match(/class="community-jumps-slide"/g)).toHaveLength(1);
    expect(html).toContain("hidden");
    expect(html).toContain("1 / 1");
  });
});

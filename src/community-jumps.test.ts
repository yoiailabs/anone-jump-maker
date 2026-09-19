import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMP_CAPACITY,
  COMMUNITY_JUMP_POSTS,
  DEFAULT_COMMUNITY_JUMP_SORT,
  communityJumpFromHref,
  communityJumpFromInput,
  parseCommunityJumpHref,
  sortCommunityJumpPosts,
} from "./community-jumps.ts";

const NEWEST_ID = "2101288627989057912";
const OLDEST_ID = "2011056367419998636";
const MOST_LIKED_ID = "2100570924915548571";

describe("community jump posts", () => {
  it("keeps 152 unique curated posts with likes and dates", () => {
    expect(COMMUNITY_JUMP_POSTS).toHaveLength(152);
    expect(COMMUNITY_JUMP_POSTS.length).toBeLessThanOrEqual(COMMUNITY_JUMP_CAPACITY);
    expect(COMMUNITY_JUMP_CAPACITY).toBe(160);
    expect(new Set(COMMUNITY_JUMP_POSTS.map((post) => post.id)).size).toBe(152);
    expect(COMMUNITY_JUMP_POSTS.every((post) => post.media === "video")).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.every((post) => post.createdAt && post.likes != null)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === "2100797924125049167")).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === NEWEST_ID)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === OLDEST_ID)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === OLDEST_ID)?.createdAt).toBe("2026-01-13");
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === MOST_LIKED_ID)?.likes).toBe(4003);
  });

  it("defaults to newest and can sort by likes", () => {
    expect(DEFAULT_COMMUNITY_JUMP_SORT).toBe("newest");
    const newest = sortCommunityJumpPosts(COMMUNITY_JUMP_POSTS, "newest");
    expect(newest[0]?.id).toBe(NEWEST_ID);
    expect(newest[newest.length - 1]?.id).toBe(OLDEST_ID);
    expect(newest.map((post) => post.id)).toEqual(
      [...newest].sort((a, b) => {
        const byDay = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
        return byDay !== 0 ? byDay : b.id.localeCompare(a.id);
      }).map((post) => post.id),
    );
    const popular = sortCommunityJumpPosts(COMMUNITY_JUMP_POSTS, "popular");
    expect(popular[0]?.id).toBe(MOST_LIKED_ID);
    expect(popular[0]?.likes).toBe(4003);
    expect(popular[1]?.likes ?? 0).toBeLessThanOrEqual(4003);
  });

  it("parses handle and status id from an https x.com status URL", () => {
    expect(parseCommunityJumpHref("https://x.com/_nakotanmaru/status/2100880092864122959")).toEqual({
      handle: "_nakotanmaru",
      id: "2100880092864122959",
    });
    expect(communityJumpFromHref("https://x.com/02_ZERO_Ni/status/2100797924125049167", 738)).toEqual({
      id: "2100797924125049167",
      href: "https://x.com/02_ZERO_Ni/status/2100797924125049167",
      handle: "02_ZERO_Ni",
      likes: 738,
      media: "video",
    });
    expect(
      communityJumpFromInput({
        href: "https://x.com/aku11i/status/2100742211289989572",
        likes: 107,
        createdAt: "2026-09-18",
        media: "text",
      }),
    ).toEqual({
      id: "2100742211289989572",
      href: "https://x.com/aku11i/status/2100742211289989572",
      handle: "aku11i",
      likes: 107,
      createdAt: "2026-09-18",
      media: "text",
    });
  });

  it("rejects non-x status URLs and bad dates so the list stays easy to swap safely", () => {
    expect(() => parseCommunityJumpHref("https://example.com/status/1")).toThrow(
      "community jump の URL が不正です",
    );
    expect(() => parseCommunityJumpHref("https://x.com/foo")).toThrow("community jump の URL が不正です");
    expect(() =>
      communityJumpFromInput({ href: "https://x.com/foo/status/1", createdAt: "18 Sept" }),
    ).toThrow("community jump の日付が不正です");
  });
});

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

const NEWEST_ID = "2102200171975360714";
const OLDEST_ID = "2009475998488961327";
const MOST_LIKED_ID = "2084205622862725181";
const APPENDED_IDS = [
  "2102200171975360714",
  "2102193633772622182",
  "2102175646151749829",
  "2102173448252559674",
  "2102159725945409653",
  "2102107519300898952",
  "2102105570094506072",
  "2102082996644069593",
  "2102074565467967505",
  "2102068194550964409",
  "2102066526316798260",
  "2102063122974671353",
  "2102063116972597547",
  "2102062682354708918",
  "2102053146331857372",
  "2102049021900812572",
  "2102048568785932439",
  "2102041089419120853",
  "2102040552304951536",
  "2102031803213385974",
  "2102027526814183635",
  "2102024597600366990",
  "2102021903930347566",
  "2102011723519856946",
  "2102011374868254760",
  "2102004693425922402",
  "2102000777451728981",
  "2101998361331318973",
  "2101989826908090744",
  "2101984910458441973",
  "2101979410450858411",
  "2101977837783912819",
  "2101973419080487421",
  "2101955727548178815",
  "2101953639371911403",
  "2101939980054778151",
  "2101934538486423609",
  "2101896326384665055",
  "2101872393669247166",
  "2101853576394154434",
  "2101848560891552182",
  "2101803923954970918",
  "2101746140035363283",
  "2101715669175922922",
  "2101700547963387962",
  "2101699383423299627",
  "2101698339196817884",
  "2101696630798065995",
  "2101696357635604707",
  "2101690466144268452",
  "2101686703870390782",
  "2101670403978785243",
  "2101656473487237268",
  "2101641487494848827",
  "2101577757742510581",
  "2101570963095933014",
  "2101534786691182749",
  "2101533110802276606",
  "2101498936926380482",
  "2101478657181253730",
  "2101464502088929332",
  "2101368635604504828",
  "2101361588733374680",
] as const;
const OFFICIAL_IDS = [
  "2100840133016912147",
  "2100137115950653708",
  "2084205622862725181",
  "2010200476005048711",
] as const;

describe("community jump posts", () => {
  it("keeps 556 unique curated posts with likes and dates", () => {
    expect(COMMUNITY_JUMP_POSTS).toHaveLength(556);
    expect(COMMUNITY_JUMP_POSTS.length).toBeLessThanOrEqual(COMMUNITY_JUMP_CAPACITY);
    expect(COMMUNITY_JUMP_CAPACITY).toBe(1024);
    expect(new Set(COMMUNITY_JUMP_POSTS.map((post) => post.id)).size).toBe(556);
    expect(APPENDED_IDS.every((id) => COMMUNITY_JUMP_POSTS.some((post) => post.id === id))).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.every((post) => post.media === "video")).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.every((post) => post.createdAt && post.likes != null)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === "2100797924125049167")).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === NEWEST_ID)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.some((post) => post.id === OLDEST_ID)).toBe(true);
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === NEWEST_ID)?.createdAt).toBe("2026-09-22");
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === NEWEST_ID)?.handle).toBe("LocalToshimaen");
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === OLDEST_ID)?.createdAt).toBe("2026-01-09");
    expect(COMMUNITY_JUMP_POSTS.find((post) => post.id === MOST_LIKED_ID)?.likes).toBe(37005);
    expect(COMMUNITY_JUMP_POSTS.filter((post) => post.handle === "Nanatsukaze_ofc").map((post) => post.id).sort()).toEqual(
      [...OFFICIAL_IDS].sort(),
    );
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
    expect(popular[0]?.likes).toBe(37005);
    expect(popular[1]?.likes ?? 0).toBeLessThanOrEqual(37005);
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

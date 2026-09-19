import { describe, expect, it } from "vitest";
import {
  COMMUNITY_JUMP_POSTS,
  communityJumpFromHref,
  parseCommunityJumpHref,
} from "./community-jumps.ts";

const CURATED_HREFS = [
  "https://x.com/02_ZERO_Ni/status/2100797924125049167",
  "https://x.com/_nakotanmaru/status/2100880092864122959",
  "https://x.com/aku11i/status/2100742211289989572",
  "https://x.com/dra_travel/status/2100962659432898564",
  "https://x.com/tararahonya/status/2100899162812260789",
  "https://x.com/yamagutinobot/status/2100908244877414815",
  "https://x.com/yukku018/status/2100945726188769743",
  "https://x.com/_yofukasi_3150/status/2100906505587626344",
  "https://x.com/ebibluepro/status/2100854065173574116",
  "https://x.com/merrieszzw30/status/2100886138257121546",
] as const;

const CURATED_LIKES = [738, 646, 107, 44, 36, 33, 26, 26, 23, 17] as const;

describe("community jump posts", () => {
  it("keeps the curated 10 in likes-desc order with ids from the URLs", () => {
    expect(COMMUNITY_JUMP_POSTS).toHaveLength(10);
    expect(COMMUNITY_JUMP_POSTS.map((post) => post.href)).toEqual([...CURATED_HREFS]);
    expect(COMMUNITY_JUMP_POSTS.map((post) => post.likes)).toEqual([...CURATED_LIKES]);
    expect(COMMUNITY_JUMP_POSTS.map((post) => post.id)).toEqual([
      "2100797924125049167",
      "2100880092864122959",
      "2100742211289989572",
      "2100962659432898564",
      "2100899162812260789",
      "2100908244877414815",
      "2100945726188769743",
      "2100906505587626344",
      "2100854065173574116",
      "2100886138257121546",
    ]);
    expect(COMMUNITY_JUMP_POSTS.map((post) => post.handle)).toEqual([
      "02_ZERO_Ni",
      "_nakotanmaru",
      "aku11i",
      "dra_travel",
      "tararahonya",
      "yamagutinobot",
      "yukku018",
      "_yofukasi_3150",
      "ebibluepro",
      "merrieszzw30",
    ]);
  });

  it("parses handle and status id from an https x.com status URL", () => {
    expect(parseCommunityJumpHref(CURATED_HREFS[1])).toEqual({
      handle: "_nakotanmaru",
      id: "2100880092864122959",
    });
    expect(communityJumpFromHref(CURATED_HREFS[0], 738)).toEqual({
      id: "2100797924125049167",
      href: CURATED_HREFS[0],
      handle: "02_ZERO_Ni",
      likes: 738,
    });
  });

  it("rejects non-x status URLs so the list stays easy to swap safely", () => {
    expect(() => parseCommunityJumpHref("https://example.com/status/1")).toThrow(
      "community jump の URL が不正です",
    );
    expect(() => parseCommunityJumpHref("https://x.com/foo")).toThrow("community jump の URL が不正です");
  });
});

/** 「みんなの #あのねジャンプ」に載せる X の動画投稿。差し替えはこの配列だけ。 */

/** カードの予約高さ。widgets.js が伸びても masonry が暴れないようにする。 */
export type CommunityJumpMedia = "video" | "text";

/** CURATED_JUMPS に足す行。href 必須、ほかは省略可。 */
export type CommunityJumpInput = {
  readonly href: string;
  readonly likes?: number;
  /** 省略時は video（ジャンプ動画）。 */
  readonly media?: CommunityJumpMedia;
};

export type CommunityJumpPost = {
  readonly id: string;
  readonly href: string;
  readonly handle?: string;
  readonly likes?: number;
  readonly media: CommunityJumpMedia;
};

/** 一覧の目安上限。これ以上は別ページや「もっと見る」に任せる。 */
export const COMMUNITY_JUMP_CAPACITY = 30;

const X_STATUS =
  /^https:\/\/x\.com\/([A-Za-z0-9_]+)\/status\/(\d+)\/?$/;

/**
 * いいね降順の curated。行を足す／入れ替えるだけで一覧に出る。
 * media を省略した行は video。容量の目安は COMMUNITY_JUMP_CAPACITY。
 */
const CURATED_JUMPS: readonly CommunityJumpInput[] = [
  { href: "https://x.com/02_ZERO_Ni/status/2100797924125049167", likes: 738 },
  { href: "https://x.com/_nakotanmaru/status/2100880092864122959", likes: 646 },
  { href: "https://x.com/aku11i/status/2100742211289989572", likes: 107 },
  { href: "https://x.com/dra_travel/status/2100962659432898564", likes: 44 },
  { href: "https://x.com/tararahonya/status/2100899162812260789", likes: 36 },
  { href: "https://x.com/yamagutinobot/status/2100908244877414815", likes: 33 },
  { href: "https://x.com/yukku018/status/2100945726188769743", likes: 26 },
  { href: "https://x.com/_yofukasi_3150/status/2100906505587626344", likes: 26 },
  { href: "https://x.com/ebibluepro/status/2100854065173574116", likes: 23 },
  { href: "https://x.com/merrieszzw30/status/2100886138257121546", likes: 17 },
];

export function parseCommunityJumpHref(href: string): { id: string; handle: string } {
  const match = X_STATUS.exec(href);
  if (!match) {
    throw new Error("community jump の URL が不正です");
  }
  return { handle: match[1], id: match[2] };
}

export function communityJumpFromInput(input: CommunityJumpInput): CommunityJumpPost {
  const { id, handle } = parseCommunityJumpHref(input.href);
  const media = input.media ?? "video";
  if (input.likes == null) {
    return { id, href: input.href, handle, media };
  }
  return { id, href: input.href, handle, likes: input.likes, media };
}

export function communityJumpFromHref(
  href: string,
  likes?: number,
  media?: CommunityJumpMedia,
): CommunityJumpPost {
  return communityJumpFromInput({ href, likes, media });
}

export const COMMUNITY_JUMP_POSTS: readonly CommunityJumpPost[] = CURATED_JUMPS.map((row) =>
  communityJumpFromInput(row),
);

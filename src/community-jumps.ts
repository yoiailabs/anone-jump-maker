/** 「みんなの #あのねジャンプ」に載せる X の動画投稿。差し替えはこの配列だけ。 */
export type CommunityJumpPost = {
  readonly id: string;
  readonly href: string;
  readonly handle?: string;
  readonly likes?: number;
};

const X_STATUS =
  /^https:\/\/x\.com\/([A-Za-z0-9_]+)\/status\/(\d+)\/?$/;

/** いいね降順の curated 10。href を足す／入れ替えるだけで一覧に出る。 */
const CURATED_JUMPS: readonly { href: string; likes: number }[] = [
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

export function communityJumpFromHref(href: string, likes?: number): CommunityJumpPost {
  const { id, handle } = parseCommunityJumpHref(href);
  if (likes == null) {
    return { id, href, handle };
  }
  return { id, href, handle, likes };
}

export const COMMUNITY_JUMP_POSTS: readonly CommunityJumpPost[] = CURATED_JUMPS.map((row) =>
  communityJumpFromHref(row.href, row.likes),
);

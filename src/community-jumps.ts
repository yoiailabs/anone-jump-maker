/** 「みんなの #あのねジャンプ」に載せる X の動画投稿。差し替えはこの配列だけ。 */

/** カードの予約高さ。widgets.js が伸びても masonry が暴れないようにする。 */
export type CommunityJumpMedia = "video" | "text";

export const COMMUNITY_JUMP_SORTS = ["newest", "popular"] as const;
export type CommunityJumpSort = (typeof COMMUNITY_JUMP_SORTS)[number];
export const DEFAULT_COMMUNITY_JUMP_SORT: CommunityJumpSort = "newest";

/** CURATED_JUMPS に足す行。href 必須、ほかは省略可。 */
export type CommunityJumpInput = {
  readonly href: string;
  readonly likes?: number;
  /** YYYY-MM-DD。新しい順のキー。省略時は日付なしとして後ろへ。 */
  readonly createdAt?: string;
  /** 省略時は video（ジャンプ動画）。 */
  readonly media?: CommunityJumpMedia;
};

export type CommunityJumpPost = {
  readonly id: string;
  readonly href: string;
  readonly handle?: string;
  readonly likes?: number;
  readonly createdAt?: string;
  readonly media: CommunityJumpMedia;
};

/** 一覧の目安上限。行を足すだけで増える。 */
export const COMMUNITY_JUMP_CAPACITY = 80;

const X_STATUS =
  /^https:\/\/x\.com\/([A-Za-z0-9_]+)\/status\/(\d+)\/?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * あのね反応ウォッチの curated。href / likes / createdAt を足すだけで一覧に出る。
 * media を省略した行は video。初期表示は新しい順。
 */
const CURATED_JUMPS: readonly CommunityJumpInput[] = [
  { href: "https://x.com/02_ZERO_Ni/status/2100797924125049167", likes: 738, createdAt: "2026-09-18" },
  { href: "https://x.com/_nakotanmaru/status/2100880092864122959", likes: 646, createdAt: "2026-09-18" },
  { href: "https://x.com/aku11i/status/2100742211289989572", likes: 107, createdAt: "2026-09-18" },
  { href: "https://x.com/dra_travel/status/2100962659432898564", likes: 44, createdAt: "2026-09-18" },
  { href: "https://x.com/tararahonya/status/2100899162812260789", likes: 36, createdAt: "2026-09-18" },
  { href: "https://x.com/yamagutinobot/status/2100908244877414815", likes: 33, createdAt: "2026-09-18" },
  { href: "https://x.com/yukku018/status/2100945726188769743", likes: 26, createdAt: "2026-09-18" },
  { href: "https://x.com/_yofukasi_3150/status/2100906505587626344", likes: 26, createdAt: "2026-09-18" },
  { href: "https://x.com/ebibluepro/status/2100854065173574116", likes: 23, createdAt: "2026-09-18" },
  { href: "https://x.com/merrieszzw30/status/2100886138257121546", likes: 17, createdAt: "2026-09-18" },
  { href: "https://x.com/cola_rumiren0/status/2100164507607949586", likes: 275, createdAt: "2026-09-16" },
  { href: "https://x.com/ayokajika/status/2100172357013008424", likes: 122, createdAt: "2026-09-16" },
  { href: "https://x.com/hina_choco4/status/2100432315445096644", likes: 23, createdAt: "2026-09-17" },
  { href: "https://x.com/kokkun_game/status/2100546032765718823", likes: 30, createdAt: "2026-09-17" },
  { href: "https://x.com/aku11i/status/2100558802638778760", likes: 23, createdAt: "2026-09-17" },
  { href: "https://x.com/PIKASONIC_ofc/status/2100570924915548571", likes: 4003, createdAt: "2026-09-17" },
  { href: "https://x.com/Sea_tanukiudon/status/2100572059445477639", likes: 21, createdAt: "2026-09-17" },
  { href: "https://x.com/4nj3_l/status/2100578422162612726", likes: 54, createdAt: "2026-09-17" },
  { href: "https://x.com/hiro_pic_1/status/2100584976303673505", likes: 177, createdAt: "2026-09-17" },
  { href: "https://x.com/adahoshi_21108/status/2100600842235830633", likes: 178, createdAt: "2026-09-18" },
  { href: "https://x.com/wuhengyu2004/status/2100610528548880646", likes: 15, createdAt: "2026-09-18" },
  { href: "https://x.com/shiketamago/status/2100613567280185829", likes: 23, createdAt: "2026-09-18" },
  { href: "https://x.com/yms26f/status/2100624372067369034", likes: 25, createdAt: "2026-09-18" },
  { href: "https://x.com/Rely000rely/status/2100632286685487166", likes: 17, createdAt: "2026-09-18" },
  { href: "https://x.com/Kinako_sub233/status/2100707190504038757", likes: 16, createdAt: "2026-09-18" },
  { href: "https://x.com/mariri3830/status/2100721970115715383", likes: 15, createdAt: "2026-09-18" },
  { href: "https://x.com/kabuzunda/status/2100766195662438739", likes: 15, createdAt: "2026-09-18" },
  { href: "https://x.com/Komesora_VRC/status/2100831498895245402", likes: 17, createdAt: "2026-09-18" },
  { href: "https://x.com/nandeyaorz/status/2100841419099517334", likes: 45, createdAt: "2026-09-18" },
  { href: "https://x.com/bloom_choose_b/status/2100850992174743556", likes: 25, createdAt: "2026-09-18" },
  { href: "https://x.com/UminoMiu222/status/2100868635623591972", likes: 21, createdAt: "2026-09-18" },
  { href: "https://x.com/niachi529/status/2100869718613909878", likes: 17, createdAt: "2026-09-18" },
  { href: "https://x.com/3_KUN_/status/2100885177891422262", likes: 11, createdAt: "2026-09-18" },
  { href: "https://x.com/ts64w_/status/2100894533974393117", likes: 14, createdAt: "2026-09-18" },
  { href: "https://x.com/Midoh_013/status/2100904130646856144", likes: 25, createdAt: "2026-09-18" },
  { href: "https://x.com/Sor4noheya/status/2100906336217432096", likes: 15, createdAt: "2026-09-18" },
  { href: "https://x.com/bloom_choose_b/status/2100911443965260243", likes: 26, createdAt: "2026-09-18" },
  { href: "https://x.com/habotan_bloom/status/2100928096262344908", likes: 15, createdAt: "2026-09-18" },
  { href: "https://x.com/ebibluepro/status/2100959062842282036", likes: 14, createdAt: "2026-09-18" },
  { href: "https://x.com/nmkenji/status/2100968136417972539", likes: 19, createdAt: "2026-09-19" },
  { href: "https://x.com/c4ADZd1VBa58251/status/2100969860843134983", likes: 14, createdAt: "2026-09-19" },
  { href: "https://x.com/tararahonya/status/2100992221852090651", likes: 75, createdAt: "2026-09-19" },
  { href: "https://x.com/yato3i/status/2100995164106047898", likes: 17, createdAt: "2026-09-19" },
  { href: "https://x.com/hartaro_o/status/2101021949996765489", likes: 39, createdAt: "2026-09-19" },
  { href: "https://x.com/Molu10_1284/status/2101033013727617232", likes: 12, createdAt: "2026-09-19" },
  { href: "https://x.com/nmnm_nm22/status/2101041280956645540", likes: 29, createdAt: "2026-09-19" },
  { href: "https://x.com/yukiyuki_0503/status/2101097464195400006", likes: 13, createdAt: "2026-09-19" },
  { href: "https://x.com/MeitoNagoyaBot/status/2101136207908601901", likes: 12, createdAt: "2026-09-19" },
  { href: "https://x.com/nmnm_nm22/status/2101245669646438862", likes: 13, createdAt: "2026-09-19" },
  { href: "https://x.com/FukuiKenmin_bot/status/2101249359254102088", likes: 17, createdAt: "2026-09-19" },
  { href: "https://x.com/qmapon/status/2101252511386710099", likes: 19, createdAt: "2026-09-19" },
];

export function parseCommunityJumpHref(href: string): { id: string; handle: string } {
  const match = X_STATUS.exec(href);
  if (!match) {
    throw new Error("community jump の URL が不正です");
  }
  return { handle: match[1], id: match[2] };
}

export function isCommunityJumpSort(value: string | null | undefined): value is CommunityJumpSort {
  return value === "newest" || value === "popular";
}

export function communityJumpFromInput(input: CommunityJumpInput): CommunityJumpPost {
  const { id, handle } = parseCommunityJumpHref(input.href);
  if (input.createdAt != null && !DAY.test(input.createdAt)) {
    throw new Error("community jump の日付が不正です");
  }
  return {
    id,
    href: input.href,
    handle,
    media: input.media ?? "video",
    ...(input.likes == null ? {} : { likes: input.likes }),
    ...(input.createdAt == null ? {} : { createdAt: input.createdAt }),
  };
}

export function communityJumpFromHref(
  href: string,
  likes?: number,
  media?: CommunityJumpMedia,
): CommunityJumpPost {
  return communityJumpFromInput({ href, likes, media });
}

export function compareCommunityJumpPosts(
  a: CommunityJumpPost,
  b: CommunityJumpPost,
  sort: CommunityJumpSort = DEFAULT_COMMUNITY_JUMP_SORT,
): number {
  if (sort === "popular") {
    const likes = (b.likes ?? 0) - (a.likes ?? 0);
    if (likes !== 0) return likes;
  }
  const byDay = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  if (byDay !== 0) return byDay;
  return b.id.localeCompare(a.id);
}

export function sortCommunityJumpPosts(
  posts: readonly CommunityJumpPost[],
  sort: CommunityJumpSort = DEFAULT_COMMUNITY_JUMP_SORT,
): CommunityJumpPost[] {
  return [...posts].sort((a, b) => compareCommunityJumpPosts(a, b, sort));
}

function dedupeCommunityJumps(rows: readonly CommunityJumpInput[]): CommunityJumpInput[] {
  const seen = new Set<string>();
  const unique: CommunityJumpInput[] = [];
  for (const row of rows) {
    const { id } = parseCommunityJumpHref(row.href);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }
  return unique;
}

export const COMMUNITY_JUMP_POSTS: readonly CommunityJumpPost[] = dedupeCommunityJumps(CURATED_JUMPS).map(
  (row) => communityJumpFromInput(row),
);

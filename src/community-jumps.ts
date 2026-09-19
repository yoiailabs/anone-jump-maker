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
export const COMMUNITY_JUMP_CAPACITY = 160;

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
  { href: "https://x.com/wktkhnkc1852/status/2101288627989057912", likes: 5, createdAt: "2026-09-19" },
  { href: "https://x.com/yukinekokaren/status/2101281790241763761", likes: 6, createdAt: "2026-09-19" },
  { href: "https://x.com/FinalventNet/status/2101277112258973812", likes: 7, createdAt: "2026-09-19" },
  { href: "https://x.com/mz_nr/status/2101252427165184487", likes: 10, createdAt: "2026-09-19" },
  { href: "https://x.com/Toyamaken_bot/status/2101223647524565204", likes: 6, createdAt: "2026-09-19" },
  { href: "https://x.com/Asagi_info/status/2101212444039450921", likes: 6, createdAt: "2026-09-19" },
  { href: "https://x.com/aki_saku391/status/2101206563340140551", likes: 5, createdAt: "2026-09-19" },
  { href: "https://x.com/Thukikage_541/status/2101189981876486319", likes: 8, createdAt: "2026-09-19" },
  { href: "https://x.com/artemixfn/status/2101186258404061594", likes: 5, createdAt: "2026-09-19" },
  { href: "https://x.com/Smith_L_W/status/2101180389922631710", likes: 8, createdAt: "2026-09-19" },
  { href: "https://x.com/gogo__shima/status/2101174916972425502", likes: 5, createdAt: "2026-09-19" },
  { href: "https://x.com/maydel_pso2/status/2101073544465535259", likes: 9, createdAt: "2026-09-19" },
  { href: "https://x.com/nxmurei/status/2101065441334509876", likes: 10, createdAt: "2026-09-19" },
  { href: "https://x.com/AsiN04361944/status/2101051566740685184", likes: 5, createdAt: "2026-09-19" },
  { href: "https://x.com/yuu50835603/status/2101000953185054756", likes: 8, createdAt: "2026-09-19" },
  { href: "https://x.com/nekosirogiro/status/2100962394285703646", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/azusawa_com/status/2100936546384072981", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/Kalanchoe518/status/2100922531666595877", likes: 8, createdAt: "2026-09-18" },
  { href: "https://x.com/Black_umya/status/2100921962474389924", likes: 11, createdAt: "2026-09-18" },
  { href: "https://x.com/cikama2025/status/2100917763438993553", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/AITELI02/status/2100917159975334191", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/Nyakari0422/status/2100912366485655793", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/ts64w_/status/2100910938044199014", likes: 11, createdAt: "2026-09-18" },
  { href: "https://x.com/dxd50515379/status/2100910467455836575", likes: 8, createdAt: "2026-09-18" },
  { href: "https://x.com/FalcorLife64072/status/2100907611956891913", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/chuku_suilen/status/2100905103012327647", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/ALNxALT/status/2100903370370515345", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/96_Scarf_Espeon/status/2100902804189810927", likes: 12, createdAt: "2026-09-18" },
  { href: "https://x.com/VfLcPI4qES19291/status/2100897848061784121", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/shonana2000/status/2100896996890743012", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/sor4chann3/status/2100893348198490163", likes: 9, createdAt: "2026-09-18" },
  { href: "https://x.com/otomi_misozi/status/2100893265813967062", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/manadurunaE231/status/2100889474595184922", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/tactical_ahiru/status/2100885519928553590", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/Flare0316/status/2100883437490159740", likes: 9, createdAt: "2026-09-18" },
  { href: "https://x.com/kokoroe1676/status/2100882505046147389", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/ynynmgnm/status/2100877869287346186", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/nunn_sub0111/status/2100875786400203143", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/rokurogi_atro/status/2100871987505885387", likes: 12, createdAt: "2026-09-18" },
  { href: "https://x.com/nlv_rnohl/status/2100871220871016714", likes: 9, createdAt: "2026-09-18" },
  { href: "https://x.com/Hanayanokusa/status/2100867109312246215", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/tetupura02/status/2100866278802215294", likes: 9, createdAt: "2026-09-18" },
  { href: "https://x.com/rh3cat/status/2100857078583796160", likes: 12, createdAt: "2026-09-18" },
  { href: "https://x.com/Rin_afterglow/status/2100851216414835007", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/Rinshima_2525/status/2100842221197308401", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/sora_Vsokuhou/status/2100834460518490153", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/mc_frame_/status/2100818302838906949", likes: 9, createdAt: "2026-09-18" },
  { href: "https://x.com/micannotubu/status/2100801507050578202", likes: 13, createdAt: "2026-09-18" },
  { href: "https://x.com/ad_motsu/status/2100722569364283560", likes: 8, createdAt: "2026-09-18" },
  { href: "https://x.com/azure222jp/status/2100721231100248384", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/hallnoa1/status/2100661992084398554", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/TY880168289080/status/2100626125131251788", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/Mattya_Shouta/status/2100624772631871894", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/teratera139/status/2100622850407432280", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/BachTTPOfficial/status/2100618855555236247", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/iihhlc/status/2100613865503588831", likes: 7, createdAt: "2026-09-18" },
  { href: "https://x.com/kurigohan81902/status/2100613204707823909", likes: 10, createdAt: "2026-09-18" },
  { href: "https://x.com/83yami_jp/status/2100613028542906632", likes: 12, createdAt: "2026-09-18" },
  { href: "https://x.com/imasugurinne24/status/2100608229642539272", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/Natte_games/status/2100607914184753471", likes: 6, createdAt: "2026-09-18" },
  { href: "https://x.com/AMA47981827/status/2100607739760357407", likes: 13, createdAt: "2026-09-18" },
  { href: "https://x.com/Ry_Mit/status/2100604445864448296", likes: 5, createdAt: "2026-09-18" },
  { href: "https://x.com/Cephalo14310/status/2100600499598966872", likes: 7, createdAt: "2026-09-17" },
  { href: "https://x.com/utatane_sayu/status/2100600247936532580", likes: 5, createdAt: "2026-09-17" },
  { href: "https://x.com/ROBIn_Yukimura/status/2100600011583259118", likes: 6, createdAt: "2026-09-17" },
  { href: "https://x.com/ice_t777/status/2100598020974973304", likes: 8, createdAt: "2026-09-17" },
  { href: "https://x.com/turumo/status/2100594663837282360", likes: 5, createdAt: "2026-09-17" },
  { href: "https://x.com/ichigekidao/status/2100591522492346625", likes: 5, createdAt: "2026-09-17" },
  { href: "https://x.com/Shiritorituyome/status/2100587953198440763", likes: 11, createdAt: "2026-09-17" },
  { href: "https://x.com/a3_order/status/2100587572934406486", likes: 7, createdAt: "2026-09-17" },
  { href: "https://x.com/zmqfzt/status/2100569205825572976", likes: 19, createdAt: "2026-09-17" },
  { href: "https://x.com/Keiseitetsu_mad/status/2100560971785969685", likes: 10, createdAt: "2026-09-17" },
  { href: "https://x.com/Bakibaki_ow/status/2100551869949170169", likes: 6, createdAt: "2026-09-17" },
  { href: "https://x.com/KankitsuGori/status/2100501359321911532", likes: 11, createdAt: "2026-09-17" },
  { href: "https://x.com/obake_no_rakoko/status/2100459668279796193", likes: 9, createdAt: "2026-09-17" },
  { href: "https://x.com/riri_0__0/status/2100407518493356368", likes: 7, createdAt: "2026-09-17" },
  { href: "https://x.com/as_7u_/status/2100393675616665778", likes: 8, createdAt: "2026-09-17" },
  { href: "https://x.com/ENE080828/status/2100380895622713791", likes: 7, createdAt: "2026-09-17" },
  { href: "https://x.com/Mattarisitaize/status/2100371664509026558", likes: 7, createdAt: "2026-09-17" },
  { href: "https://x.com/teya1004/status/2100368219202822302", likes: 10, createdAt: "2026-09-17" },
  { href: "https://x.com/emoooo_8888/status/2100336424943849572", likes: 11, createdAt: "2026-09-17" },
  { href: "https://x.com/Usora_music_/status/2100268730798551056", likes: 12, createdAt: "2026-09-17" },
  { href: "https://x.com/Tsu_sugi0419/status/2100248124866646326", likes: 6, createdAt: "2026-09-17" },
  { href: "https://x.com/BachTTPOfficial/status/2100244505694003389", likes: 6, createdAt: "2026-09-17" },
  { href: "https://x.com/489_inb/status/2100236979401351353", likes: 14, createdAt: "2026-09-16" },
  { href: "https://x.com/vl5df/status/2100231697489101027", likes: 5, createdAt: "2026-09-16" },
  { href: "https://x.com/azusawa_com/status/2100230051505868908", likes: 10, createdAt: "2026-09-16" },
  { href: "https://x.com/haru1006_gt/status/2100223203188887877", likes: 7, createdAt: "2026-09-16" },
  { href: "https://x.com/ya59_m/status/2100220733884711198", likes: 5, createdAt: "2026-09-16" },
  { href: "https://x.com/syuineko_ST18/status/2100190901700333855", likes: 8, createdAt: "2026-09-16" },
  { href: "https://x.com/Sakura_stella03/status/2100177930571874326", likes: 8, createdAt: "2026-09-16" },
  { href: "https://x.com/sh1buyasan1921/status/2100167201282236430", likes: 9, createdAt: "2026-09-16" },
  { href: "https://x.com/azusawa_com/status/2100144159445365080", likes: 17, createdAt: "2026-09-16" },
  { href: "https://x.com/karamun2007/status/2094797912551330259", likes: 26, createdAt: "2026-09-01" },
  { href: "https://x.com/mirumiru_0823/status/2074915595901181957", likes: 19, createdAt: "2026-07-08" },
  { href: "https://x.com/soraneko_1223/status/2038791088765608446", likes: 211, createdAt: "2026-03-31" },
  { href: "https://x.com/RioHachi/status/2036404098078220749", likes: 57, createdAt: "2026-03-24" },
  { href: "https://x.com/niatearmoon/status/2024437561968775578", likes: 21, createdAt: "2026-02-19" },
  { href: "https://x.com/anohitoHRS/status/2015094673929560149", likes: 120, createdAt: "2026-01-24" },
  { href: "https://x.com/nom_kz_beat/status/2012676882312147260", likes: 36, createdAt: "2026-01-18" },
  { href: "https://x.com/Midoh_013/status/2011056367419998636", likes: 20, createdAt: "2026-01-13" },
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

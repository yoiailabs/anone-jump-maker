import { describe, expect, it } from "vitest";
import { t } from "./i18n.ts";
import {
  COMMUNITY_JUMPS_EMPTY,
  COMMUNITY_JUMPS_LEDE,
  COMMUNITY_JUMPS_TITLE,
  COMMUNITY_JUMP_PAGE_SIZE,
  COMMUNITY_MASONRY_BREAKPOINTS,
  COMMUNITY_MASONRY_GAP_PX,
  COMMUNITY_MASONRY_ROW_PX,
  DEFAULT_COMMUNITY_JUMP_PAGE,
  COMMUNITY_HASHTAG_SEARCH_LINKS,
  MORE_JUMPS_HREF,
  MORE_JUMPS_QUERY,
  applyCommunityMasonryItem,
  applyCommunityMasonryLayout,
  clampCommunityJumpPage,
  communityHashtagSearchHtml,
  communityJumpPageCount,
  communityJumpPagePosts,
  communityJumpsSectionHtml,
  communityMasonryColumns,
  communityMasonryRowSpan,
  communityPagerHtml,
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
  sortCommunityJumpPosts,
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
    expect(COMMUNITY_MASONRY_BREAKPOINTS).toEqual({ tablet: 640, wide: 768 });
    expect(communityMasonryColumns(390)).toBe(1);
    expect(communityMasonryColumns(639)).toBe(1);
    expect(communityMasonryColumns(640)).toBe(2);
    expect(communityMasonryColumns(767)).toBe(2);
    expect(communityMasonryColumns(768)).toBe(3);
    expect(communityMasonryColumns(820)).toBe(3);
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
  it("lays out one masonry page of 50 with pager chrome and no carousel", () => {
    const newest = sortCommunityJumpPosts(COMMUNITY_JUMP_POSTS, "newest");
    const page1 = communityJumpPagePosts(newest, 1);
    const html = communityJumpsSectionHtml();
    expect(COMMUNITY_JUMP_PAGE_SIZE).toBe(50);
    expect(DEFAULT_COMMUNITY_JUMP_PAGE).toBe(1);
    expect(communityJumpPageCount(493)).toBe(10);
    expect(html).toContain(`<h1 id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h1>`);
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain('id="communityJumps"');
    expect(html).toContain('id="communityJumpsList"');
    expect(html).toContain("community-jumps-masonry");
    expect(html).toContain('data-sort="newest"');
    expect(html).toContain('data-page="1"');
    expect(html).toContain('id="communitySortNewest"');
    expect(html).toContain('id="communitySortPopular"');
    expect(html).toContain("新しい順");
    expect(html).toContain("人気順");
    expect(html).toContain('data-media="video"');
    expect(html).toContain('id="toMaker"');
    expect(html).toContain('id="toMakerBottom"');
    expect(html).toContain('href="/"');
    expect(html).toContain('class="page-link"');
    expect(html).toContain("メーカーに戻る");
    expect(html).toMatch(/<h1 id="communityJumpsTitle">[^<]+<\/h1>/);
    expect(html).not.toContain('id="communityHashtag"');
    expect(html).not.toContain("community-hashtag-link");
    expect(html).toContain('id="communityHashtagSearch"');
    expect(html).toContain("community-hashtag-search");
    expect(html).toContain(`href="${MORE_JUMPS_HREF}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('id="moreJumps"');
    expect(html).not.toContain("community-more-btn");
    expect(html).not.toContain("もっと見る");
    expect(MORE_JUMPS_HREF).toBe(`https://x.com/search?q=${encodeURIComponent(MORE_JUMPS_QUERY)}`);
    expect(html.match(/id="toMaker"/g)).toHaveLength(1);
    expect(html.match(/メーカーに戻る/g)).toHaveLength(2);
    expect(html).toContain('<p class="eyebrow">#あのねジャンプ</p>');
    expect(html).not.toContain('<p class="eyebrow"><a');
    expect(html.indexOf("toMaker")).toBeLessThan(html.indexOf("communityJumpsList"));
    expect(html.indexOf("communityJumpsList")).toBeLessThan(html.indexOf("communityPager"));
    expect(html.indexOf("communityPager")).toBeLessThan(html.indexOf("communityHashtagSearch"));
    expect(html.indexOf("communityHashtagSearch")).toBeLessThan(html.indexOf("toMakerBottom"));
    expect(html).toContain('class="lang-switch"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('href="/en/community"');
    expect(html).not.toContain("app-tab");
    expect(html).not.toContain("communityJumpsPrev");
    expect(html).not.toContain("communityJumpsNext");
    expect(html).not.toContain("communityJumpsMeter");
    expect(html).not.toContain("community-jumps-track");
    expect(html).not.toContain("community-jumps-viewport");
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(50);
    expect(html.match(/data-media="video"/g)).toHaveLength(50);
    expect(html.match(/data-post-id="2101336573879239085"/g)).toHaveLength(1);
    expect(html).not.toContain('data-post-id="2009475998488961327"');
    expect(html).toContain("@Muni_0362");
    expect(html).toContain(`data-post-id="${page1[page1.length - 1]?.id}"`);
    expect(html).toContain('id="communityPager"');
    expect(html).toContain('id="communityPagePrev"');
    expect(html).toContain('id="communityPageNext"');
    expect(html).toContain("前へ");
    expect(html).toContain("次へ");
    expect(html.match(/data-community-page="/g)).toHaveLength(2);
    expect(html).not.toContain("community-page-num");
    expect(html).not.toContain("community-pager-pages");
    expect(html).not.toMatch(/<button[^>]*>\d+<\/button>/);
    expect(html).toContain('id="communityPagePrev" data-community-page="0" disabled');
    const popular = communityJumpsSectionHtml(undefined, "ja", "popular");
    expect(popular.indexOf("2010196958527533380")).toBeLessThan(popular.indexOf("2100570924915548571"));
    expect(popular).toContain('data-sort="popular"');
    expect(popular).toContain("@Nanatsukaze_ofc");
    expect(popular).toContain('data-post-id="2084205622862725181"');
    expect(popular.match(/class="community-jumps-item"/g)).toHaveLength(50);
    const lastPage = communityJumpsSectionHtml(undefined, "ja", "newest", 10);
    expect(lastPage).toContain('data-page="10"');
    expect(lastPage.match(/class="community-jumps-item"/g)).toHaveLength(43);
    expect(lastPage).toContain('data-post-id="2009475998488961327"');
    expect(lastPage).toContain("@PIKASONIC_ofc");
    expect(lastPage).toContain('id="communityPageNext" data-community-page="11" disabled');
  });

  it("pages a long curated list 50 at a time so new rows are drop-in", () => {
    const posts = Array.from({ length: 60 }, (_, index) =>
      communityJumpFromHref(`https://x.com/user${index}/status/${2_100_000_000_000_000 + index}`, index + 1),
    );
    const html = communityJumpsSectionHtml(posts);
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(50);
    expect(communityJumpPageCount(60)).toBe(2);
    expect(COMMUNITY_JUMP_CAPACITY).toBeGreaterThanOrEqual(493);
    expect(html).toContain("community-jumps-masonry");
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain("communitySort");
    expect(html).toContain('id="communityPager"');
    expect(html).not.toContain("community-jumps-track");
  });

  it("shows an empty state and no list when the posts are swapped to empty", () => {
    const empty: readonly CommunityJumpPost[] = [];
    const html = communityJumpsSectionHtml(empty);
    expect(html).toContain(COMMUNITY_JUMPS_EMPTY);
    expect(html).toContain(`<h1 id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h1>`);
    expect(html).toContain('id="toMakerBottom"');
    expect(html).toContain('id="communityHashtagSearch"');
    expect(html).not.toContain('id="communityHashtag"');
    expect(html).not.toContain("community-hashtag-link");
    expect(html).not.toContain('id="moreJumps"');
    expect(html).not.toContain("community-jumps-list");
    expect(html).not.toContain("communitySort");
    expect(html).not.toContain("communityPager");
    expect(html).not.toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain("こっちにもあるよ");
    expect(html.indexOf("community-jumps-empty")).toBeLessThan(html.indexOf("communityHashtagSearch"));
    expect(html.indexOf("communityHashtagSearch")).toBeLessThan(html.indexOf("toMakerBottom"));
  });

  it("keeps a single masonry item when only one post remains", () => {
    const html = communityJumpsSectionHtml(COMMUNITY_JUMP_POSTS.slice(0, 1));
    expect(html.match(/class="community-jumps-item"/g)).toHaveLength(1);
    expect(html).toContain("community-jumps-masonry");
    expect(html).not.toContain("communitySort");
    expect(html).not.toContain("communityPager");
    expect(html).toContain(COMMUNITY_JUMPS_LEDE);
    expect(html).toContain(`<h1 id="communityJumpsTitle">${COMMUNITY_JUMPS_TITLE}</h1>`);
  });
});

describe("community hashtag search links", () => {
  it("keeps the title as plain text and puts SNS search banners below the pager", () => {
    expect(COMMUNITY_JUMPS_TITLE).toBe("みんなの #あのねジャンプ");
    expect(COMMUNITY_HASHTAG_SEARCH_LINKS.map((link) => link.id)).toEqual([
      "x",
      "instagram",
      "youtube",
      "tiktok",
    ]);
    expect(COMMUNITY_HASHTAG_SEARCH_LINKS.find((link) => link.id === "x")?.href).toBe(MORE_JUMPS_HREF);
    expect(COMMUNITY_HASHTAG_SEARCH_LINKS.find((link) => link.id === "instagram")?.href).toBe(
      `https://www.instagram.com/explore/tags/${encodeURIComponent(MORE_JUMPS_QUERY.slice(1))}/`,
    );
    expect(COMMUNITY_HASHTAG_SEARCH_LINKS.find((link) => link.id === "youtube")?.href).toBe(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(MORE_JUMPS_QUERY)}`,
    );
    expect(COMMUNITY_HASHTAG_SEARCH_LINKS.find((link) => link.id === "tiktok")?.href).toBe(
      `https://www.tiktok.com/tag/${encodeURIComponent(MORE_JUMPS_QUERY.slice(1))}`,
    );

    const html = communityJumpsSectionHtml();
    expect(html).toMatch(/<h1 id="communityJumpsTitle">みんなの #あのねジャンプ<\/h1>/);
    expect(html).not.toContain("community-hashtag-link");
    expect(html).not.toContain('id="communityHashtag"');
    expect(html).toContain('<p class="eyebrow">#あのねジャンプ</p>');
    expect(html).not.toContain('<p class="eyebrow"><a');

    const ledeIdx = html.indexOf(`<p class="lede">${COMMUNITY_JUMPS_LEDE}</p>`);
    const sortIdx = html.indexOf('id="communitySort"');
    const pagerIdx = html.indexOf('id="communityPager"');
    const searchIdx = html.indexOf('id="communityHashtagSearch"');
    const headingIdx = html.indexOf('id="communityHashtagSearchHeading"');
    expect(ledeIdx).toBeGreaterThan(-1);
    expect(sortIdx).toBeGreaterThan(ledeIdx);
    expect(sortIdx).toBeLessThan(html.indexOf("communityJumpsList"));
    expect(pagerIdx).toBeGreaterThan(html.indexOf("communityJumpsList"));
    expect(searchIdx).toBeGreaterThan(pagerIdx);
    expect(headingIdx).toBeGreaterThan(pagerIdx);
    expect(headingIdx).toBeLessThan(searchIdx);
    expect(html).toContain("こっちにもあるよ");
    expect(html).toContain('id="communityHashtagSearchHeading"');

    for (const link of COMMUNITY_HASHTAG_SEARCH_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`data-service="${link.id}"`);
    }
    expect(html.match(/class="link-banner"/g)).toHaveLength(4);
    expect(html.match(/target="_blank"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('aria-label="Xで #あのねジャンプ を検索する（新しいタブ）"');
    expect(html).toContain('aria-label="Instagramで #あのねジャンプ を検索する（新しいタブ）"');
    expect(html).toContain('aria-label="YouTubeで #あのねジャンプ を検索する（新しいタブ）"');
    expect(html).toContain('aria-label="TikTokで #あのねジャンプ を検索する（新しいタブ）"');
    expect(html).toContain('aria-label="#あのねジャンプを探す"');
    expect(html).not.toContain("ナナツカゼさんのXを開く");
    expect(html).not.toContain('id="moreJumps"');
    expect(html).not.toContain("もっと見る");

    const en = communityJumpsSectionHtml(undefined, "en");
    expect(en).toContain(`<h1 id="communityJumpsTitle">${t("en", "communityTitle")}</h1>`);
    expect(en).toContain("Search #あのねジャンプ on X (new tab)");
    expect(en).toContain("Also on these apps");
    expect(communityHashtagSearchHtml("ko")).toContain("다른 앱에도 있어");
    expect(communityHashtagSearchHtml("zh")).toContain("这些应用上也有哦");
    expect(communityHashtagSearchHtml("ko")).toContain("X에서 #あのねジャンプ 검색(새 탭)");
    expect(communityHashtagSearchHtml("zh")).toContain("在X搜索 #あのねジャンプ（新标签页）");
    for (const locale of ["ja", "en", "ko", "zh"] as const) {
      const titleHtml = communityJumpsSectionHtml(undefined, locale);
      expect(titleHtml).toContain(`<h1 id="communityJumpsTitle">${t(locale, "communityTitle")}</h1>`);
      expect(titleHtml).not.toContain("community-hashtag-link");
    }
  });
});

describe("community pagination", () => {
  it("slices 50 posts per page and clamps out-of-range pages", () => {
    expect(communityJumpPageCount(0)).toBe(0);
    expect(communityJumpPageCount(-1)).toBe(0);
    expect(communityJumpPageCount(50)).toBe(1);
    expect(communityJumpPageCount(51)).toBe(2);
    expect(communityJumpPageCount(493)).toBe(10);
    expect(clampCommunityJumpPage(0, 493)).toBe(1);
    expect(clampCommunityJumpPage(1.5, 493)).toBe(1);
    expect(clampCommunityJumpPage(11, 493)).toBe(10);
    expect(clampCommunityJumpPage(3, 493)).toBe(3);
    const newest = sortCommunityJumpPosts(COMMUNITY_JUMP_POSTS, "newest");
    const page1 = communityJumpPagePosts(newest, 1);
    const page10 = communityJumpPagePosts(newest, 10);
    expect(page1).toHaveLength(50);
    expect(page1[0]?.id).toBe("2101336573879239085");
    expect(page10).toHaveLength(43);
    expect(page10[page10.length - 1]?.id).toBe("2009475998488961327");
    expect(communityJumpPagePosts(newest, 99).at(-1)?.id).toBe("2009475998488961327");
  });

  it("renders only previous and next, disabling the ends", () => {
    const first = communityPagerHtml(493, 1);
    expect(first).toContain("前へ");
    expect(first).toContain("次へ");
    expect(first).toContain('id="communityPagePrev" data-community-page="0" disabled');
    expect(first).toContain('id="communityPageNext" data-community-page="2"');
    expect(first).not.toContain("community-page-num");
    expect(first).not.toContain("community-pager-pages");
    expect(first).not.toContain('aria-current="page"');
    expect(first).not.toMatch(/<button[^>]*>\d+<\/button>/);
    expect(first.match(/data-community-page="/g)).toHaveLength(2);

    const middle = communityPagerHtml(493, 3);
    expect(middle).toContain('id="communityPagePrev" data-community-page="2"');
    expect(middle).toContain('id="communityPageNext" data-community-page="4"');
    expect(middle).not.toContain(" disabled");

    const last = communityPagerHtml(493, 10);
    expect(last).toContain('id="communityPagePrev" data-community-page="9"');
    expect(last).toContain('id="communityPageNext" data-community-page="11" disabled');
    expect(last).not.toContain("community-page-num");
  });

  it("hides the pager when everything fits on one page", () => {
    const posts = Array.from({ length: 50 }, (_, index) =>
      communityJumpFromHref(`https://x.com/user${index}/status/${2_100_000_000_000_000 + index}`, index + 1),
    );
    expect(communityPagerHtml(50, 1)).toBe("");
    expect(communityJumpsSectionHtml(posts)).not.toContain("communityPager");
  });
});

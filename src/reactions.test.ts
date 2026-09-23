import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hydrateReactionEmbed,
  isEmbedHostVisible,
  reactionEmbedHtml,
  remountReactionEmbed,
  REACTION_POSTS,
  whenEmbedHostVisible,
  whenNearViewport,
} from "./reactions.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reaction embeds", () => {
  it("lists official Nanatsukaze first, then PIKASONIC, then nakotanmaru, then later fan posts", () => {
    expect(REACTION_POSTS.map((post) => post.id)).toEqual([
      "2100840133016912147",
      "2100570924915548571",
      "2100880092864122959",
      "2100797924125049167",
      "2100906505587626344",
      "2100928096262344908",
      "2100921962474389924",
      "2100613865503588831",
      "2100897848061784121",
    ]);
    expect(REACTION_POSTS[0]?.href).toBe(
      "https://x.com/Nanatsukaze_ofc/status/2100840133016912147",
    );
    expect(REACTION_POSTS[1]?.href).toBe(
      "https://x.com/PIKASONIC_ofc/status/2100570924915548571",
    );
    expect(REACTION_POSTS[2]?.href).toBe(
      "https://x.com/_nakotanmaru/status/2100880092864122959",
    );
    expect(REACTION_POSTS[2]?.handle).toBe("_nakotanmaru");
    expect(REACTION_POSTS.at(-1)?.href).toBe(
      "https://x.com/VfLcPI4qES19291/status/2100897848061784121",
    );
  });

  it("embeds Nanatsukaze above PIKASONIC, then nakotanmaru, then the added posts", () => {
    const html = reactionEmbedHtml();
    const nanatsukaze = html.indexOf("2100840133016912147");
    const pikasonic = html.indexOf("2100570924915548571");
    const nakotanmaru = html.indexOf("2100880092864122959");
    const added = [
      "2100797924125049167",
      "2100906505587626344",
      "2100928096262344908",
      "2100921962474389924",
      "2100613865503588831",
      "2100897848061784121",
    ].map((id) => html.indexOf(id));
    expect(nanatsukaze).toBeGreaterThan(-1);
    expect(pikasonic).toBeGreaterThan(nanatsukaze);
    expect(nakotanmaru).toBeGreaterThan(pikasonic);
    expect(added.every((index) => index > nakotanmaru)).toBe(true);
    expect(added).toEqual([...added].sort((a, b) => a - b));
    expect(html).toContain("@Nanatsukaze_ofc");
    expect(html).toContain("ナナツカゼ");
    expect(html).toContain("簡単に作れるようになったﾆｬ!");
    expect(html).toContain("pic.twitter.com/ONLDedNFIH");
    expect(html).toContain("2026年9月18日");
  });

  it("keeps the PIKASONIC post from the official URL", () => {
    const html = reactionEmbedHtml();
    expect(html).toContain(`href="${REACTION_POSTS[1]?.href}?ref_src=twsrc%5Etfw"`);
    expect(html).toContain("おおおお簡単に作れた！！すげぇ！！");
    expect(html).toContain("@PIKASONIC_ofc");
    expect(html).toContain("2026年9月17日");
  });

  it("keeps the nakotanmaru post third from the official URL", () => {
    const html = reactionEmbedHtml();
    const post = REACTION_POSTS[2];
    expect(post?.id).toBe("2100880092864122959");
    expect(html).toContain(`href="${post?.href}?ref_src=twsrc%5Etfw"`);
    expect(html).toContain("僕の好きな空の写真でやってみた");
    expect(html).toContain("同じ空は二度と見れないんだよ");
    expect(html).toContain("@_nakotanmaru");
    expect(html).toContain("nakotanmaru");
    expect(html).toContain("pic.twitter.com/ocpFNsQRb9");
    expect(html).toContain("https://t.co/ocpFNsQRb9");
  });

  it("appends the six fan posts under the existing reactions", () => {
    const html = reactionEmbedHtml();
    const added = REACTION_POSTS.slice(3);
    expect(added.map((post) => post.href)).toEqual([
      "https://x.com/02_ZERO_Ni/status/2100797924125049167",
      "https://x.com/_yofukasi_3150/status/2100906505587626344",
      "https://x.com/habotan_bloom/status/2100928096262344908",
      "https://x.com/Black_umya/status/2100921962474389924",
      "https://x.com/iihhlc/status/2100613865503588831",
      "https://x.com/VfLcPI4qES19291/status/2100897848061784121",
    ]);
    for (const post of added) {
      expect(html).toContain(`href="${post.href}?ref_src=twsrc%5Etfw"`);
      expect(html).toContain(`@${post.handle}`);
      expect(html).toContain(post.author);
      expect(html).toContain(post.dateLabel);
    }
    expect(html).toContain("普通にこれ神すぎてやばい");
    expect(html).toContain("神すぎるだろこのサイトwww");
    expect(html).toContain("ファンメイドのこれ楽しい〜〜〜");
    expect(html).toContain("大好きな曲の神メーカーをお借りしました🫶");
    expect(html).toContain("#やねから見てるよ");
    expect(html).toContain("めっちゃ簡単に作れた！");
    expect(html).toContain("すごい、あっという間作れる！");
  });

  it("renders official twitter-tweet blockquotes for widgets.js", () => {
    const html = reactionEmbedHtml();
    expect(html.match(/class="twitter-tweet"/g)).toHaveLength(REACTION_POSTS.length);
    expect(html).toContain('data-dnt="true"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain("#あのねジャンプ");
    expect(html).toContain("#あのねジャンプメーカー");
  });

  it("loads widgets once for the whole container", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const container = { id: "reactionsEmbed" } as HTMLElement;
    vi.stubGlobal("window", { twttr: { widgets: { load } } });
    hydrateReactionEmbed(container);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(container);
  });

  it("treats a missing layout API as visible so node tests can load widgets", () => {
    expect(isEmbedHostVisible({ id: "reactionsEmbed" } as HTMLElement)).toBe(true);
  });

  it("hides hosts that sit in a [hidden] ancestor or have no box", () => {
    expect(
      isEmbedHostVisible({
        closest: (sel: string) => (sel === "[hidden]" ? ({} as HTMLElement) : null),
        getBoundingClientRect: () => ({ width: 320, height: 200 }),
      } as HTMLElement),
    ).toBe(false);
    expect(
      isEmbedHostVisible({
        closest: () => null,
        getBoundingClientRect: () => ({ width: 0, height: 0 }),
      } as unknown as HTMLElement),
    ).toBe(false);
    expect(
      isEmbedHostVisible({
        closest: () => null,
        getBoundingClientRect: () => ({ width: 320, height: 400 }),
      } as unknown as HTMLElement),
    ).toBe(true);
  });

  it("does not hydrate or remount while the parent is hidden", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const container = {
      innerHTML: "<iframe class=\"twitter-tweet-rendered\"></iframe>",
      closest: (sel: string) => (sel === "[hidden]" ? ({} as HTMLElement) : null),
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
    } as HTMLElement;
    vi.stubGlobal("window", { twttr: { widgets: { load } } });
    hydrateReactionEmbed(container);
    remountReactionEmbed(container, "<blockquote class=\"twitter-tweet\"></blockquote>");
    expect(load).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("<iframe class=\"twitter-tweet-rendered\"></iframe>");
  });

  it("remounts collapsed iframes as blockquotes then loads widgets", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const container = {
      innerHTML: "<iframe class=\"twitter-tweet-rendered\" height=\"0\"></iframe>",
      closest: () => null,
      getBoundingClientRect: () => ({ width: 320, height: 400 }),
    } as unknown as HTMLElement;
    vi.stubGlobal("window", { twttr: { widgets: { load } } });
    remountReactionEmbed(container, "<blockquote class=\"twitter-tweet\"></blockquote>");
    expect(container.innerHTML).toContain("twitter-tweet");
    expect(container.innerHTML).not.toContain("iframe");
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(container);
  });

  it("runs whenEmbedHostVisible only after the host has a box", () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const run = vi.fn();
    whenEmbedHostVisible(
      {
        closest: () => null,
        getBoundingClientRect: () => ({ width: 320, height: 200 }),
      } as unknown as HTMLElement,
      run,
    );
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    whenEmbedHostVisible(
      {
        closest: (sel: string) => (sel === "[hidden]" ? ({} as HTMLElement) : null),
        getBoundingClientRect: () => ({ width: 0, height: 0 }),
      } as HTMLElement,
      run,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("runs whenNearViewport immediately without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const run = vi.fn();
    const stop = whenNearViewport({} as Element, run);
    expect(run).toHaveBeenCalledTimes(1);
    stop();
  });

  it("observes the target and runs on the first intersection", () => {
    const observers: Array<{
      cb: IntersectionObserverCallback;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeIO implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "0px";
      readonly scrollMargin = "0px";
      readonly thresholds = [0];
      takeRecords = () => [];
      unobserve = vi.fn();
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(cb: IntersectionObserverCallback) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push({ cb, observe: this.observe, disconnect: this.disconnect });
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    const target = { id: "reactionsEmbed" } as unknown as Element;
    const run = vi.fn();
    whenNearViewport(target, run);
    expect(run).not.toHaveBeenCalled();
    expect(observers).toHaveLength(1);
    expect(observers[0]?.observe).toHaveBeenCalledWith(target);
    observers[0]?.cb(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observers[0] as unknown as IntersectionObserver,
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(observers[0]?.disconnect).toHaveBeenCalled();
  });
});

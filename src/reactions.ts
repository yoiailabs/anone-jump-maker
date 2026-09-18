/** 画面最下部の「反応」に載せる X の埋め込み。公式 oEmbed の HTML をそのまま使う。 */
export type ReactionPost = {
  readonly id: string;
  readonly handle: string;
  readonly author: string;
  readonly href: string;
  readonly dateLabel: string;
  /** publish.x.com が返す <p> 内 HTML（ハッシュタグ・動画サムネ用 t.co）。 */
  readonly bodyHtml: string;
};

const HASHTAG_ANONE =
  "https://x.com/hashtag/%E3%81%82%E3%81%AE%E3%81%AD%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%97?src=hash&amp;ref_src=twsrc%5Etfw";
const HASHTAG_MAKER =
  "https://x.com/hashtag/%E3%81%82%E3%81%AE%E3%81%AD%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%97%E3%83%A1%E3%83%BC%E3%82%AB%E3%83%BC?src=hash&amp;ref_src=twsrc%5Etfw";

/** 上から順に表示する。先頭が公式ナナツカゼ。 */
export const REACTION_POSTS: readonly ReactionPost[] = [
  {
    id: "2100840133016912147",
    handle: "Nanatsukaze_ofc",
    author: "ナナツカゼ",
    href: "https://x.com/Nanatsukaze_ofc/status/2100840133016912147",
    dateLabel: "2026年9月18日",
    bodyHtml: `<a href="${HASHTAG_ANONE}">#あのねジャンプ</a> が<br>簡単に作れるようになったﾆｬ!<a href="${HASHTAG_MAKER}">#あのねジャンプメーカー</a> <br>ぜひ試してみてね ^. .^ ੭ <a href="https://t.co/ONLDedNFIH">pic.twitter.com/ONLDedNFIH</a>`,
  },
  {
    id: "2100570924915548571",
    handle: "PIKASONIC_ofc",
    author: "PIKASONIC",
    href: "https://x.com/PIKASONIC_ofc/status/2100570924915548571",
    dateLabel: "2026年9月17日",
    bodyHtml: `おおおお簡単に作れた！！すげぇ！！<a href="${HASHTAG_ANONE}">#あのねジャンプ</a>　<a href="${HASHTAG_MAKER}">#あのねジャンプメーカー</a> <a href="https://t.co/bE2NrhhaEI">pic.twitter.com/bE2NrhhaEI</a>`,
  },
];

const WIDGETS_SRC = "https://platform.twitter.com/widgets.js";
const WIDGETS_SCRIPT_ID = "twitter-wjs";

type TwitterWidgetsApi = {
  widgets: {
    load: (element?: HTMLElement) => Promise<unknown>;
  };
};

type TwitterQueue = {
  widgets?: TwitterWidgetsApi["widgets"];
  _e?: Array<(twttr: TwitterWidgetsApi) => void>;
  ready?: (callback: (twttr: TwitterWidgetsApi) => void) => void;
};

declare global {
  interface Window {
    twttr?: TwitterQueue;
  }
}

function embedBlockquote(post: ReactionPost): string {
  return `
    <blockquote class="twitter-tweet" data-lang="ja" data-dnt="true" data-align="center">
      <p lang="ja" dir="ltr">${post.bodyHtml}</p>
      &mdash; ${post.author} (@${post.handle})
      <a href="${post.href}?ref_src=twsrc%5Etfw">${post.dateLabel}</a>
    </blockquote>
  `;
}

/** publish.x.com が返す blockquote を投稿順に並べる。widgets.js が iframe に置き換える。 */
export function reactionEmbedHtml(): string {
  return REACTION_POSTS.map(embedBlockquote).join("");
}

/** innerHTML のあとで呼び、公式ウィジェットに差し替える（複数 blockquote も一度で load）。 */
export function hydrateReactionEmbed(container: HTMLElement): void {
  const run = (twttr: TwitterWidgetsApi) => {
    void twttr.widgets.load(container);
  };

  const queued = window.twttr;
  if (queued?.widgets?.load) {
    run({ widgets: queued.widgets });
    return;
  }
  if (queued?.ready) {
    queued.ready(run);
    ensureWidgetsScript();
    return;
  }

  window.twttr = {
    _e: [run],
    ready(callback) {
      const api = window.twttr;
      if (api?.widgets?.load) {
        callback({ widgets: api.widgets });
        return;
      }
      (api?._e ?? (this._e = [])).push(callback);
    },
  };
  ensureWidgetsScript();
}

function ensureWidgetsScript(): void {
  if (document.getElementById(WIDGETS_SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = WIDGETS_SCRIPT_ID;
  script.src = WIDGETS_SRC;
  script.async = true;
  script.charset = "utf-8";
  document.body.append(script);
}

/** 画面最下部の「反応」に載せる X の埋め込み。公式 oEmbed の HTML をそのまま使う。 */
export const REACTION_POST = {
  id: "2100570924915548571",
  handle: "PIKASONIC_ofc",
  author: "PIKASONIC",
  href: "https://x.com/PIKASONIC_ofc/status/2100570924915548571",
} as const;

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

/** publish.x.com が返す blockquote。widgets.js が iframe に置き換える。 */
export function reactionEmbedHtml(): string {
  return `
    <blockquote class="twitter-tweet" data-lang="ja" data-dnt="true" data-align="center">
      <p lang="ja" dir="ltr">おおおお簡単に作れた！！すげぇ！！<a href="https://x.com/hashtag/%E3%81%82%E3%81%AE%E3%81%AD%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%97?src=hash&amp;ref_src=twsrc%5Etfw">#あのねジャンプ</a>　<a href="https://x.com/hashtag/%E3%81%82%E3%81%AE%E3%81%AD%E3%82%B8%E3%83%A3%E3%83%B3%E3%83%97%E3%83%A1%E3%83%BC%E3%82%AB%E3%83%BC?src=hash&amp;ref_src=twsrc%5Etfw">#あのねジャンプメーカー</a> <a href="https://t.co/bE2NrhhaEI">pic.twitter.com/bE2NrhhaEI</a></p>
      &mdash; ${REACTION_POST.author} (@${REACTION_POST.handle})
      <a href="${REACTION_POST.href}?ref_src=twsrc%5Etfw">2026年9月17日</a>
    </blockquote>
  `;
}

/** innerHTML のあとで呼び、公式ウィジェットに差し替える。 */
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

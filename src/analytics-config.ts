/**
 * GA4 の読み込み可否と、Layout に埋め込む gtag の初期化スクリプト。
 * 本番ホスト（anone.yoiailabs.com）以外（fork・ローカル・Preview）では何も送らない。
 * `PUBLIC_GA4_MEASUREMENT_ID` をビルド時に明示したときだけ、ホストに関係なくその ID で有効にする。
 */
export const PRODUCTION_HOST = "anone.yoiailabs.com";

/** 本番の GA4 測定 ID。 */
export const GA4_MEASUREMENT_ID = "G-L8WKQQFBZC";

export type AnalyticsConfig = {
  readonly measurementId: string;
  readonly productionHost: string;
  /** true なら本番ホスト以外でも有効（env で ID を明示したとき）。 */
  readonly force: boolean;
};

export function resolveAnalyticsConfig(envMeasurementId: string | undefined): AnalyticsConfig {
  const override = envMeasurementId?.trim();
  return {
    measurementId: override || GA4_MEASUREMENT_ID,
    productionHost: PRODUCTION_HOST,
    force: Boolean(override),
  };
}

export function isAnalyticsEnabled(hostname: string, config: AnalyticsConfig): boolean {
  return config.force || hostname === config.productionHost;
}

/**
 * `<script is:inline>` に入れる本文。有効でないホストでは `window.gtag` を定義しないので、
 * `src/analytics.ts` のイベント送信はすべて何もしない。
 * 初回描画を奪わないよう、アイドル／操作後に gtag.js を載せる（本番の挙動は従来どおり）。
 */
export function gtagBootstrapScript(config: AnalyticsConfig): string {
  const id = JSON.stringify(config.measurementId);
  const host = JSON.stringify(config.productionHost);
  const force = config.force ? "true" : "false";
  return `(function () {
  if (!${force} && window.location.hostname !== ${host}) return;
  var id = ${id};
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  function loadGtag() {
    if (window.__gtagRequested) return;
    window.__gtagRequested = true;
    var script = document.createElement("script");
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    script.async = true;
    script.onload = function () {
      gtag("js", new Date());
      gtag("config", id);
    };
    document.head.appendChild(script);
  }
  ["pointerdown", "keydown", "scroll"].forEach(function (name) {
    window.addEventListener(name, loadGtag, { once: true, passive: true });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") loadGtag();
  });
  setTimeout(loadGtag, 20000);
})();`;
}

/**
 * GA4 の読み込み。測定 ID はビルド時の `PUBLIC_GA4_MEASUREMENT_ID` だけ。
 * 未設定ならスクリプトを出さず、`src/analytics.ts` の送信は何もしない。
 * ホストでは分岐しない。fork・ローカル・Preview は変数が無い限り送らない。
 */
export type AnalyticsConfig = {
  readonly measurementId: string | null;
};

export function resolveAnalyticsConfig(envMeasurementId: string | undefined): AnalyticsConfig {
  const id = envMeasurementId?.trim();
  return { measurementId: id || null };
}

export function isAnalyticsEnabled(config: AnalyticsConfig): boolean {
  return config.measurementId != null;
}

/**
 * `<script is:inline>` に入れる本文。ID が無いときは空文字（script タグ自体を出さない）。
 * 初回描画を奪わないよう、操作後か 20 秒後に gtag.js を載せる。
 */
export function gtagBootstrapScript(config: AnalyticsConfig): string {
  if (!config.measurementId) return "";
  const id = JSON.stringify(config.measurementId);
  return `(function () {
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

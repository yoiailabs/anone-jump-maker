# 計測（GA4 / Sentry）

Google Analytics 4 と Sentry は、ビルドに測定 ID と DSN が残っているときだけ読み込みます。ID はリポジトリに含まれません。空ならスクリプトを出さず、何も送りません。

fork や手元のビルドから、このチームの Sentry プロジェクトと GA4 プロパティへデータを送らないでください。使うなら、自分の DSN と測定 ID をビルド時の環境変数に置きます。チームの値をコピーして使わないでください。

## 環境変数

| 変数 | 役割 |
| --- | --- |
| `VITE_SENTRY_DSN` | Sentry の DSN。未設定なら `@sentry/browser` を読み込まない |
| `PUBLIC_GA4_MEASUREMENT_ID` | GA4 の測定 ID（`G-` で始まる）。未設定なら gtag.js を読み込まない |

空の例は [`.env.example`](../.env.example) です。使うときは `.env` にコピーして値を入れます。`.env` はコミットしません。本番の値は、Worker `anone` の Workers Builds のビルド変数に置きます。ソースやこのドキュメントには書きません。

Workers Builds のビルド変数は、Preview のビルドにも付きます。`WORKERS_CI` があるビルドでは、`WORKERS_CI_BRANCH` が `main` のときだけ値をページに埋め込みます（`src/telemetry-build.ts` の `shouldEmbedTelemetry`）。それ以外のブランチは、ビルド前にこの 2 つの変数を外すので、SDK を読み込みません。本番ブランチの名前を変えるときは `PRODUCTION_BRANCH` も変えてください。

手元の `pnpm build` には `WORKERS_CI` が無いので、`.env` に書いた値がそのまま入ります。Cloudflare の Workers Builds では `WORKERS_CI` が付き、ブランチが `main` のときだけ埋め込みます。fork で Workers Builds を使うときも同じで、入るのはその fork のビルド変数です。チームの DSN と測定 ID は置かないでください。変数を空にしておけば、SDK は読み込まれず、チームの計測先へは送られません。

## 送るもの

件数は画面に出さず、ブラウザから GA4 のカスタムイベントだけ送ります（`src/analytics.ts`、読み込みは `src/analytics-config.ts` と `src/layouts/Layout.astro`）。gtag.js は、最初の操作（ポインタ、キー、スクロール）、タブを隠したとき、または 20 秒後に載せます。`gtag` が無い環境では何もしません。

イベントは次です。

- `make_open` — 制作画面を開いた（ランディングからの遷移と、直リンクの初回表示）
- `photo_picker_open` — ファイル選択を開いた
- `photos_selected` — 1 枚以上読み込めた（`count`）
- `photos_rejected` — 枚数や形式で 0 枚だった（短い `reason`）
- `video_preview` — プレビュー再生を始めた。同じ再生中の再開や、一時停止からの再開では送らない。閉じて開き直せば再送する
- `generate_start` — 書き出しを始めた（`count`）
- `video_save` — 保存が成功したあと
- `generate_fail` — 書き出しが失敗した（既知の失敗は短い `reason`。未知の文面はそのまま送らない）
- `generate_cancel` — 書き出しをキャンセルした

`video_preview` と `video_save` のパラメータは、向き（`aspect`: `portrait` / `landscape`）とエフェクト（`effect` と `swap`: `jump` / `zoom`）だけです。写真名、ファイル、画像バイト、個人を識別する情報は送りません。

Sentry は `VITE_SENTRY_DSN` があるときだけ初期化します（`src/sentry.ts`）。ホスト名が `anone.yoiailabs.com` のとき environment は `production`、localhost のときは `development`、それ以外は `preview` です。この分類は、SDK を読むかどうかとは別です。DSN が無ければ、本番のホストでも送りません。トレースのサンプル率は 0.1 です。

確認は GA4 のリアルタイムのイベント、または探索です。

# GA4 / Sentry の設定と送信内容

操作イベントは GA4、エラーと処理時間は Sentry へ送ります。どちらも任意で、ビルド時の測定 ID・DSN が空なら、それぞれの SDK を読み込みません。

## 設定はビルド時に読み込む

| 環境変数 | 用途 |
| --- | --- |
| `PUBLIC_GA4_MEASUREMENT_ID` | GA4 の測定 ID。空なら gtag.js を読み込まない |
| `VITE_SENTRY_DSN` | Sentry の DSN。空なら `@sentry/browser` を読み込まない |

手元で使う場合は [`.env.example`](../.env.example) を `.env` にコピーし、自分の計測先を設定します。`.env` はコミットしません。Workers Builds ではビルド変数に設定します。値を変更したら再ビルドが必要です。

> [!NOTE]
> これらの値はブラウザ用の HTML / JavaScript に埋め込まれます。秘密の API キーや認証トークンを入れないでください。

[telemetry-build.ts](../src/telemetry-build.ts) と [astro.config.ts](../astro.config.ts) は、プロセスの環境変数を次の条件で扱います。

| ビルド環境 | 計測変数の扱い |
| --- | --- |
| `WORKERS_CI` が空・未設定 | 設定した値を使う。ブランチ名による制限はない |
| `WORKERS_CI` があり、`WORKERS_CI_BRANCH` が `main` | 設定した値を使う |
| `WORKERS_CI` があり、それ以外のブランチ・ブランチ名なし | ビルド前に計測変数を外す |

本番ブランチ名を変える場合は `PRODUCTION_BRANCH` も変更します。この処理が削除するのはプロセスの環境変数なので、計測値入りの `.env` を CI に持ち込まないでください。

## GA4 に送る操作イベント

[analytics-config.ts](../src/analytics-config.ts) は、最初のポインター操作・キー操作・スクロール、タブを隠したとき、または20秒後に gtag.js を読み込みます。アプリ独自のイベントは [analytics.ts](../src/analytics.ts) に定義されています。

| イベント | タイミング | パラメーター |
| --- | --- | --- |
| `make_open` | 制作画面を開いたとき。直リンクも含む | なし |
| `photo_picker_open` | 写真の選択画面を開いたとき | なし |
| `photos_selected` | 1枚以上読み込めたとき | `count`：今回追加した枚数 |
| `photos_rejected` | 上限・形式・読み込み失敗で写真を追加できなかったとき | `reason`：短い理由コード |
| `video_preview` | プレビューの再生を始めたとき | `aspect`・`effect`・`swap` |
| `generate_start` | 動画生成を始めたとき | `count`：写真の枚数 |
| `video_save` | ダウンロードを開始、またはファイル共有を完了したとき | `aspect`・`effect`・`swap` |
| `generate_fail` | 動画生成に失敗したとき | `reason`：短い理由コード |
| `generate_cancel` | 動画生成をキャンセルしたとき | なし |

`aspect` は `landscape` / `portrait`、`effect` と `swap` は同じ値で `zoom` / `jump` です。写真名・画像データはイベントに含めません。未知の生成エラーも、その文面を送らず `export_failed` に置き換えます。

`video_save` は端末への書き込み完了を保証するイベントではありません。ダウンロード開始後の保存先での操作までは取得しません。GA4 の初期化には `gtag("config", id)` も使うため、この表はアプリ独自のイベント一覧です。

## Sentry に送るエラーと処理時間

[sentry.ts](../src/sentry.ts) は、エラー情報に加えて、プレビューと動画生成の処理時間を計測します。ルートの計測名は `preview.open`、`preview.start`、`preview.playback`、`export.generate` です。トレースの基本サンプル率は0.1で、親のサンプリング判定があれば引き継ぎます。

送信前にユーザー情報、リクエスト本文・Cookie・ヘッダー、写真やファイルに関する追加情報を除去します。画像読み込みの診断には、形式の識別子、MIME、拡張子、バイト数、試した読み込み方法を残します。トレース属性も、向き・エフェクト・出力サイズ・処理時間など、コードで許可した項目に限ります。写真そのものは送信しません。

想定済みの画像読み込みエラーや生成未対応の案内、一部の翻訳スクリプト由来のエラーは除外します。`environment` は `PRODUCTION_HOST` と一致するホストで `production`、localhost 系で `development`、それ以外で `preview` です。この分類は送信を止める設定ではありません。

fork で変更する箇所は[セルフホスト](deployment.md)、外部の埋め込みなどの通信は[アーキテクチャ](architecture.md)も参照してください。

[ドキュメント目次へ](README.md)

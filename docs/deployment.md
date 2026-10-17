# fork してセルフホストする

fork では素材・公開先・運営表記を差し替えたうえで、Astro のビルド結果を Cloudflare Workers に公開します。計測を使わない場合、アプリ用の環境変数は不要です。

## 公開前に素材とサイトの設定を差し替える

> [!IMPORTANT]
> テンプレ映像とトップページの MV・静止画は MIT の対象外です。自分で権利を持つ素材に差し替えるか、取り除いてください。対象ファイルと条件は [README のライセンス節](../README.md#ライセンス)と[公式素材の権利表記](../public/official-assets/LICENSE.md)にあります。

GitHub で fork を作り、手元に clone したら、次の箇所を自分の公開内容に合わせます。Node.js と pnpm の準備は[クイックスタート](../README.md#クイックスタート)を参照してください。

| 差し替えるもの | 設定・実装 |
| --- | --- |
| Worker 名とドメイン | `cloudflare.config.ts` の `worker.name`・`domains`、`wrangler.toml` の `name`・`routes` |
| 正規 URL・OG 画像の URL | `astro.config.ts` の `site`、`src/page-meta.ts` の `APP_ORIGIN`、`public/robots.txt` の Sitemap |
| テンプレ映像・音声・切替時刻 | `src/layout.ts` の `TEMPLATES` と参照先の素材・JSON |
| トップページの MV・静止画 | `src/components/JumpLoop.tsx`。静止画の先読みは `src/layouts/Layout.astro` |
| サイト名・ロゴ・アイコン | `src/messages.ts`、`src/brand.ts`、`public/brand/`、`public/manifest.webmanifest`、`public/icons/`、`public/favicon.svg` |
| 外部リンク・埋め込み | `src/links.ts`、`src/reactions.ts`、`src/community-jumps.ts` |
| 運営者・利用規約・プライバシーポリシー | `src/messages.ts` の運営者表記、`src/terms-copy.ts`、`src/privacy-copy.ts` |
| 計測先と本番環境の判定 | ビルド時の環境変数、`src/sentry.ts` の `PRODUCTION_HOST`、`src/telemetry-build.ts` の `PRODUCTION_BRANCH` |

`cloudflare.config.ts` は `cf` 用、`wrangler.toml` は Wrangler 用です。両方の Worker 名・ドメイン・アセット設定を揃えます。`wrangler.config.ts` にも `assetsDirectory: "./dist"` と型生成の設定があります。カスタムドメインを使わない場合は `domains` と `routes` を外せます。Workers の既定ドメインでの配信は有効になっています。

### テンプレ映像はファイルの交換だけでは揃いません

縦・横とも同じ映像と音声を参照します。写真の切替時刻は `landscape-cuts.json` の `slots`、映像の切り抜き位置とキャラクターの配置は `src/layout.ts` にあります。映像を替えたら、この時刻と配置、背景色を抜く処理も確認してください。カット数を変える場合は、`src/timeline.ts` のサムネイル用カット数も合わせます。

`scripts/analyze-cuts.py` は既存テンプレ用の固定フレーム表を書き出すスクリプトです。新しい曲の拍を自動検出するものではありません。素材を取り除く場合は、その素材を表示・読み込みする UI や参照も外します。テンプレなしでは動画生成は動きません。

ロゴや OG 画像は MIT で再利用できますが、自分のサイトに合わせて更新する場合は `scripts/og.html` も変更します。`pnpm og` は英語・韓国語・中国語版、`pnpm og -- --ja` は日本語版を含む OG 画像を生成します。Playwright の Chromium が必要です。`pnpm icons` は SVG から PWA アイコンを生成し、Chrome の場所は `CHROME_PATH` で指定できます。

## ビルド結果と Worker を確認する

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

`http://127.0.0.1:4173` で静的サイトを確認できます。Worker のリダイレクトやアセット応答を確認するときは、プレビューを終了して次を実行します。

```bash
pnpm dev:worker
```

このコマンドはビルド後に `wrangler dev -c wrangler.toml` を起動します。接続先はターミナルの表示を使ってください。`pnpm dev` は `cf dev` を起動する別の入口で、先に `dist/` を生成しておく必要があります。

## 自分の Cloudflare アカウントへ公開する

公開先の設定を変更したことを確認してから実行します。

```bash
pnpm exec wrangler login
pnpm deploy
```

`pnpm deploy` は `pnpm build && wrangler deploy` です。Workers Builds を使う場合も、このリポジトリのビルドコマンドは `pnpm build` です。ビルド工程を分けて設定するならデプロイ工程は `pnpm exec wrangler deploy`、バージョンのアップロードのみなら `pnpm exec wrangler versions upload` を使います。GitHub Actions の `test.yml` はテスト用で、デプロイ処理は含みません。

GA4 / Sentry を使う場合は、自分の計測先をビルド変数に設定します。実行時の Worker 変数を変更しても、生成済みのページには反映されません。ブランチごとの有効化条件は[計測](telemetry.md)を参照してください。

公開後は、言語の切替、写真の読み込み、プレビュー、短い動画の生成と保存を確認します。自動テストの範囲と実機で確認する項目は[テスト](testing.md)にあります。

[ドキュメント目次へ](README.md)

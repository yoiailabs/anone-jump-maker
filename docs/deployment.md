# デプロイとセルフホスト

本番は [https://anone.yoiailabs.com](https://anone.yoiailabs.com) です。本体の Worker 名は `anone` で、Astro の `dist` を Cloudflare Workers の静的アセットとして配信します。ページ表示、プレビュー、保存のどれでも、サーバー側で集計処理は呼びません。

## 設定

Worker の設定は次の 2 ファイルです。中身は揃えてあります。

- `cloudflare.config.ts` — `cf` が読む設定。カスタムドメイン、静的アセット、`run_worker_first` のパス
- `wrangler.toml` — Workers Builds の `wrangler versions upload` が読む設定。`assets.directory` は `./dist`

`worker/index.ts` は、Cookie に保存した言語があるときだけトップ、制作、コミュニティをその言語の URL へ寄せます。利用規約とプライバシーポリシーの言語付き URL（`/en/privacy` など）は日本語の URL へ 302 します。クローラが日本語の title と OGP を掴むよう、`Accept-Language` では寄せません。ブラウザの言語選択はクライアント側です。

正規の URL と OGP は `astro.config.ts` の `site` と `src/page-meta.ts` の `APP_ORIGIN`（どちらも `https://anone.yoiailabs.com`）です。

## 手元から

```bash
pnpm build          # dist を作る
pnpm preview        # http://127.0.0.1:4173 でビルド結果を見る
pnpm dev:worker     # build してから wrangler dev
pnpm deploy         # build してから wrangler deploy
```

`pnpm dev`（`cf dev`）は Worker の開発サーバーです。`dist` が無いと、静的アセットのディレクトリが無いというエラーで止まります。画面を直しながらの確認は `pnpm exec astro dev`（http://127.0.0.1:5173）です。手順の全体は [README](../README.md) にあります。

`pnpm deploy` は、`wrangler login` した自分のアカウントへ出します。普段の本番公開は、`main` への push を Cloudflare Workers Builds がビルドして行う想定です。

## Workers Builds

Worker `anone` のビルドは Cloudflare 側の Workers Builds です。非本番ブランチでは `wrangler versions upload` が `wrangler.toml` を読み、そのバージョンをアップロードします。プレビュー用の URL は Cloudflare が発行します。このリポジトリには、その URL もビルド用の秘密も置いていません。

ビルド変数に計測の ID を置く場合の扱いは [計測](telemetry.md) です。Preview のビルドにも同じ変数が付くため、埋め込むかどうかはコード側で本番ブランチだけに限っています。

## fork するとき

fork して自分の環境で動かすときは、次を差し替えてください。

- **公式素材。** MIT の対象外は `public/official-assets/template/landscape.mp4`、`public/official-assets/jump-loop.mp4`、`public/official-assets/jump-loop-still.png` の 3 ファイルです。再配布はできません。自分で権利を持つ素材に差し替えるか、取り除いてください。詳しくは [public/official-assets/LICENSE.md](../public/official-assets/LICENSE.md) です。`template/landscape-cuts.json` は生成した拍の表で、MIT です。
- **Cloudflare アカウント。** `wrangler login` で自分のアカウントにデプロイします。`wrangler.toml` の `routes` と `cloudflare.config.ts` の `domains`（どちらも `anone.yoiailabs.com`）は、自分のドメインに書き換えるか消してください。Worker 名 `anone` も、必要なら変えます。ドメインを消しても `workers_dev = true` なので、自分の `*.workers.dev` では開けます。
- **URL と表記。** `astro.config.ts` の `site` と `src/page-meta.ts` の `APP_ORIGIN` を、自分の公開 URL に合わせます。Sentry に送るときの environment 名（`production` / `preview` / `development`）は `src/sentry.ts` の `PRODUCTION_HOST` で分けます。これは SDK を読み込むかどうかとは別です。
- **利用規約とプライバシーポリシー。** `src/terms-copy.ts` と `src/privacy-copy.ts`（と各言語の文面）は、Yoiailabs が運営する本番サイト用です。そのまま使わず、自分の運営内容に合わせて書き直してください。
- **計測。** このチームの Sentry と Google Analytics にデータを送らないでください。ID の置き方は [計測](telemetry.md) です。

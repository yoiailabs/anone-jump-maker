# テストを実行する

Vitest でロジックとブラウザ上の描画を、Playwright で写真選択から保存までの操作を検証します。依存関係の準備は[クイックスタート](../README.md#クイックスタート)を参照してください。

## 変更に応じて実行する

| コマンド | 対象 |
| --- | --- |
| `pnpm test` | `src/**/*.test.ts`。写真の順序、切替時刻、言語、計測、Worker などのロジック |
| `pnpm test:browser` | `src/**/*.browser.test.ts`。Canvas の描画、サムネイル、プレビューなど |
| `pnpm test:e2e` | `e2e/*.spec.ts`。写真選択・並べ替え・再生・生成・共有・言語切替などの操作 |
| `pnpm test:all` | 上の3つを順に実行 |
| `pnpm check` | Astro と Worker の型チェック |
| `pnpm types` | Cloudflare の Worker 型を生成 |

ブラウザを使うテストは、初回に Chromium と WebKit をインストールします。

```bash
pnpm exec playwright install --with-deps chromium webkit
pnpm test:all
```

ユニットテストは Node.js で動き、`.browser.test.ts` を除外します。ブラウザテストは Chromium、WebKit の順に実行します。設定は [vitest.config.ts](../vitest.config.ts) と [vitest.browser.config.ts](../vitest.browser.config.ts) にあります。

## E2E はビルド済みのサイトで動く

[playwright.config.ts](../playwright.config.ts) が `pnpm build` と `pnpm preview` を起動し、`http://127.0.0.1:4173` に接続します。ローカルでは同じ URL の既存サーバーを再利用するため、最新のビルドで確認したい場合は先にそのサーバーを終了してください。

実行設定は Desktop Chrome、Pixel 7、Desktop Safari、iPhone 13 の4種類です。いずれも Playwright のブラウザ・端末エミュレーションで、スマートフォン実機のテストではありません。

動画を扱うテストでは [e2e/helpers.ts](../e2e/helpers.ts) で短いテスト素材に差し替えます。保存テストは利用可能なエンコーダーがあれば生成を確認し、なければ未対応の案内を確認します。テスト成功だけでは、すべての端末で本番テンプレを生成できるとは判断できません。

描画や保存を変更したときは、実機でも縦・横のプレビュー、音声、生成後の保存・共有を確認します。Worker の HTTP 応答はユニットテストの対象であり、Astro preview を使う E2E では Cloudflare 上の配信まで検証しません。

## GitHub Actions で確認する範囲

[`.github/workflows/test.yml`](../.github/workflows/test.yml) は `main` への push と pull request で動きます。Node.js 22.22、pnpm 10.15.1 を使い、依存関係は `--frozen-lockfile` でインストールします。

- `Unit tests`：`pnpm types` → `pnpm check` → `pnpm test`
- `Browser and e2e tests`：ブラウザをインストール → `pnpm test:browser` → `pnpm test:e2e`

失敗時には、存在する `test-results/` と `playwright-report/` を `playwright-output` アーティファクトとして保存します。

[ドキュメント目次へ](README.md)

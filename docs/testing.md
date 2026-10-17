# テスト

Node.js 22.18 以上と pnpm 10.15.1 を使います。GitHub Actions のユニットジョブは Node.js 22.22 です。

```bash
pnpm test            # ユニット（Vitest / Node）
pnpm test:browser    # Chromium、続けて WebKit
pnpm test:e2e        # Playwright
pnpm test:all        # 上の 3 つ
```

ブラウザを使うテストの初回は、次が必要です。

```bash
pnpm exec playwright install --with-deps chromium webkit
```

## ユニット

`pnpm test` は Vitest を Node で実行します（`vitest.config.ts`）。対象は `src/**/*.test.ts` で、`src/**/*.browser.test.ts` は除きます。CI の Unit tests ジョブは、この前に `pnpm types`（`cf workers types`）と `pnpm check`（`astro check` と Worker の `tsc`）も実行します。

## ブラウザ

`pnpm test:browser` は、Vitest のブラウザモードを Chromium と WebKit で順番に実行します（`vitest.browser.config.ts`）。対象は `src/**/*.browser.test.ts` です。環境変数 `ANONE_BROWSER` は `chromium` か `webkit` です。キャンバスが重なるのを避けるため、1 プロセスの中ではファイルを並列にしません。

## e2e

`pnpm test:e2e` は Playwright です（`playwright.config.ts`、`e2e/`）。設定の webServer が `pnpm build` と `pnpm preview`（http://127.0.0.1:4173）を起動してからテストします。プロジェクトは次の 4 つです。

- `chromium` — Desktop Chrome
- `android-chrome` — Pixel 7
- `webkit` — Desktop Safari
- `ios-safari` — iPhone 13

実機の iOS Safari と Android Chrome は CI に載せられません。プレビューと短い保存クリップは、この WebKit と Chromium のエミュレーションで見ています。

## CI

`.github/workflows/test.yml` が、pull request と `main` への push で次を回します。

- Unit tests — `pnpm types`、`pnpm check`、`pnpm test`
- Browser and e2e tests — Playwright の Chromium と WebKit を入れて、`pnpm test:browser` と `pnpm test:e2e`

失敗したときは `test-results` と `playwright-report` をアーティファクトに上げます。

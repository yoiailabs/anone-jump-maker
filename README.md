<p align="center">
  <a href="https://anone.yoiailabs.com">
    <img src="public/brand/anone-logo-stacked.svg" width="360" alt="あのねジャンプメーカー">
  </a>
</p>

<p align="center">写真を選ぶだけで、キャラクターのジャンプに合わせて写真が切り替わる動画をブラウザで作れます。</p>

<p align="center">
  <a href="https://anone.yoiailabs.com"><b>anone.yoiailabs.com</b></a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
  <a href="https://github.com/yoiailabs/anone-jump-maker/actions/workflows/test.yml"><img src="https://github.com/yoiailabs/anone-jump-maker/actions/workflows/test.yml/badge.svg" alt="test ワークフロー"></a>
</p>

> [!NOTE]
> ナナツカゼ「あのね」の非公式ファンメイド作品です。ナナツカゼによる公認ではありません。テンプレ映像など一部の素材は MIT の対象外です。対象のファイルは[公式素材の権利表記](public/official-assets/LICENSE.md)にあります。

## クイックスタート

Node.js 22.18.0 以上と pnpm 10.15.1 が必要です（[package.json](package.json)）。

```bash
git clone https://github.com/yoiailabs/anone-jump-maker.git
cd anone-jump-maker
pnpm install --frozen-lockfile
pnpm exec astro dev
```

[http://127.0.0.1:5173](http://127.0.0.1:5173) を開くとアプリが動きます。環境変数の設定は要りません。

### 主なスクリプト

| コマンド | 用途 |
| --- | --- |
| `pnpm check` | Astro と Worker の型チェック |
| `pnpm build` | 型チェックと静的サイトの生成。出力先は `dist/` |
| `pnpm preview` | ビルド結果を `http://127.0.0.1:4173` で確認 |
| `pnpm dev:worker` | ビルドしてから Wrangler で Worker を起動 |
| `pnpm dev` | `cf dev` で Worker を起動。先に `pnpm build` が必要 |
| `pnpm deploy` | ビルドして Cloudflare Workers へ公開 |

## テスト

```bash
pnpm test          # ユニットテスト（Vitest）
pnpm test:browser  # Chromium と WebKit での描画テスト（Vitest Browser）
pnpm test:e2e      # 画面操作のテスト（Playwright）
```

ブラウザを使う 2 つは、初回に `pnpm exec playwright install --with-deps chromium webkit` でブラウザを入れておきます。`pnpm test:all` なら 3 つを続けて実行します。

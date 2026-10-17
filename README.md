<p align="center">
  <a href="https://anone.yoiailabs.com">
    <img src="public/brand/anone-logo-stacked.svg" width="360" alt="あのねジャンプメーカー">
  </a>
</p>

<p align="center">写真を選ぶだけで、キャラクターのジャンプに合わせて写真が切り替わる動画をブラウザで作れます。</p>

<p align="center">
  <a href="https://anone.yoiailabs.com">アプリを使う</a> ·
  <a href="docs/usage.md">使い方</a> ·
  <a href="docs/README.md">ドキュメント</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License: MIT"></a>
  <a href="https://github.com/yoiailabs/anone-jump-maker/actions/workflows/test.yml"><img src="https://github.com/yoiailabs/anone-jump-maker/actions/workflows/test.yml/badge.svg" alt="test ワークフロー"></a>
  <a href="https://anone.yoiailabs.com"><img src="https://img.shields.io/badge/web-anone.yoiailabs.com-3ebdc2" alt="公開サイト"></a>
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

公開前の差し替えは[セルフホストの手順](docs/deployment.md)にまとめています。

## テスト

```bash
pnpm test
```

これでユニットテストが走ります。ブラウザテスト（`test:browser`）と E2E（`test:e2e`）の準備と実行方法は[テストのページ](docs/testing.md)にあります。

## ドキュメント

| ページ | 内容 |
| --- | --- |
| [使い方](docs/usage.md) | 写真を並べてから動画を保存するまで |
| [アーキテクチャ](docs/architecture.md) | 写真の処理、合成、動画の書き出し、配信のしくみ |
| [セルフホスト](docs/deployment.md) | fork で差し替える素材と設定、Cloudflare Workers への公開 |
| [計測](docs/telemetry.md) | GA4 / Sentry の有効化と送る内容 |
| [テスト](docs/testing.md) | テストの種類と実行方法、CI |

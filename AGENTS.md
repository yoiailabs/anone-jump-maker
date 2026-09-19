# AGENTS.md

このリポジトリは Astro + React（`src/components/`、shadcn/ui の Base UI）です。

**特別な理由がない限り、UI は React コンポーネントで書いてください。** 新しい画面・操作・ドラッグ＆ドロップなどはバニラの `document.createElement` や直の DOM イベント組み立てにしないでください。並べ替えなら dnd-kit など React 向けのライブラリを使います。

バニラが残ってよいのは、次のような場合だけです。

- プレビュー合成や動画書き出しなど、`src/app.ts` の `boot()` がまだ持っている処理
- Canvas / WebCodecs / ファイル読み込みなど、DOM UI ではない層
- 既存の `boot()` から React へ値を渡す薄い接続（ストアやコールバック）

画面の HTML 骨格は Astro、操作パネルのインタラクションは React に足していきます。

# あのねジャンプメーカー

写真を置くと、縦テンプレのジャンプに合わせて入れ替わる小さなメーカーです。ファン制作です。本番予定 URL は [https://anone.yoiailabs.com](https://anone.yoiailabs.com) です。写真はサーバーに出さず、この端末の中だけで重ねます。

画面はナナツカゼさんのテンプレの空気に寄せています。太い線、ベタ塗りの色面、少し昔の電子ポップのような夏の残像。よいらぼの紺や金は使いません。フォントは Klee One と Zen Maru Gothic（Google Fonts）です。

## 使い方

1. 写真を数枚選ぶ
2. テンプレのベタ塗り背景（緑クロマに限らない）をキーイングして、線画キャラを残す
3. 検出したジャンプ・カット（32 スロット）で写真を差し替える。枚数が足りなければ循環
4. プレビューして WebM または MP4 を保存。対応ブラウザではテンプレを再生待ちせず、フレームをシークしてオフライン生成します（WebCodecs）。使えない／失敗したときは従来どおり MediaRecorder で録画します。

書き出しは縦（9:16）のみです。シャープな 16:9 の本編をテンプレのキャラ位置（胴〜足元）に合わせて置き、上下の余白は同じ写真を cover 拡大したブラー＋少し暗い背景にします。ブラー帯と本編パネル内の写真は、カット拍で同じ縦 hop をします。

写真の向きは EXIF を `createImageBitmap({ imageOrientation: "from-image" })` で直し、WebGL には ImageBitmap を直接上げません（`UNPACK_FLIP_Y_WEBGL` との二重反転を避けるため、Canvas2D に描いてからテクスチャ化します）。

## 開発

```bash
pnpm install   # または npm install
pnpm dev       # または npm run dev
pnpm test
pnpm build
```

デプロイ（DNS は設定しない）:

```bash
pnpm deploy    # = pnpm build && wrangler deploy
```

Worker 名は `anone`。Cloudflare Workers の静的アセットとして `dist` を配信します。

カット表 `public/template/cuts.json` は、15fps で抜いたフレームの背景色差と画素差から検出しました（閾値 pix>12 または bgd>20、最短間隔 0.2 秒）。CapCut で使われるおおよそ 32 スロットに合わせています。

## キーイング

背景は純緑クロマではなく、ティール・ライム・グレー・赤・紫などフレームごとに変わるベタ塗りです。四隅と上辺から優勢な背景色を毎フレーム推定し、色距離で抜きます。緑が勝つ画素は補助的に抜き、暗い線画は不透明のまま残し、キー色の巻き込み（スピル）を抑えます。WebGL フラグメントシェーダが本線で、未対応時は Canvas2D に落とします。

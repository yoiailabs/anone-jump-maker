# あのねジャンプメーカー

写真を置くと、縦テンプレのジャンプに合わせて入れ替わる小さなメーカーです。本番予定 URL は [https://anone.yoiailabs.com](https://anone.yoiailabs.com) です。写真はサーバーに出さず、この端末の中だけで重ねます。

画面はナナツカゼさんのテンプレの空気に寄せています。太い線、ベタ塗りの色面、少し昔の電子ポップのような夏の残像。よいらぼの紺や金は使いません。フォントは Klee One と Zen Maru Gothic（Google Fonts）です。

## 使い方

1. 写真を数枚選ぶ
2. **縦の動画（9:16）** か **横の動画（16:9）** を選ぶ
3. テンプレのベタ塗り背景（緑クロマに限らない）をキーイングして、線画キャラを残す
4. 検出したジャンプ・カット（32 スロット）で写真を差し替える。枚数が足りなければ循環
5. プレビューして WebM または MP4 を保存（MediaRecorder）

縦モードは中央にシャープな 16:9 の本編を置き、上下の余白は同じ写真を cover 拡大したブラー＋少し暗い背景にします。背景はカット拍で縦に hop します。横モードはキャンバス自体が 16:9 で、本編を横いっぱいにし、縦用のブラー帯は出しません。

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

## テンプレートと権利

`public/template/vertical.mp4` はナナツカゼさんの YouTube Short「#あのねジャンプ 縦ver.テンプレート」から取り込んだ縦（9:16）素材です。ファン試作であり、権利関係の正式確認は今後行います。公式テンプレート配布はファン制作を想定しています。

カット表 `public/template/cuts.json` は、15fps で抜いたフレームの背景色差と画素差から検出しました（閾値 pix>12 または bgd>20、最短間隔 0.2 秒）。CapCut で使われるおおよそ 32 スロットに合わせています。

## キーイング

背景は純緑クロマではなく、ティール・ライム・グレー・赤・紫などフレームごとに変わるベタ塗りです。四隅と上辺から優勢な背景色を毎フレーム推定し、色距離で抜きます。緑が勝つ画素は補助的に抜き、暗い線画は不透明のまま残し、キー色の巻き込み（スピル）を抑えます。WebGL フラグメントシェーダが本線で、未対応時は Canvas2D に落とします。

import { expect, it } from "vitest";
import { server } from "vitest/browser";
import track from "./generated/chara-iris-track.json";
import { charaIrisCenter } from "./charairis.ts";
import { characterDest, characterScale, characterShiftY, templateBandRect } from "./layout.ts";
import { KEY_PARAMS, keyAlpha, sampleKeyColor } from "./keying.ts";

it("presented template frames match the track and iris center in both aspects and every character size", async () => {
  const source = await fetch("/" + track.source.replace(/^public\//, "")).then((response) => response.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", source);
  expect(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")).toBe(track.sha256);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  // WebKitでも画面上の動画として提示させ、非表示動画の省電力制御を避ける。
  video.width = 480; video.height = 270;
  document.body.append(video);
  const loaded = new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(video.error), { once: true });
  });
  video.src = "/official-assets/template/landscape.mp4";
  try {
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = 480; canvas.height = 270;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    // seekedは要求したフレームの提示を保証しない。特にWebKitの最初のシークでは
    // currentTimeとCanvasから読める絵がずれる可能性があるため、シークを使わない。
    // 通常再生のrVFC内で読み戻し、mediaTimeに対応する表と比べる。
    // 遅いCIでは提示を間引くことがあるので、各ポーズ境界の前後の観測を必須にする。
    const windows = [[56, 58], [59, 62], [99, 101], [102, 105], [202, 204], [205, 209]] as const;
    const modes = ["landscape", "portrait"] as const;
    const observed = windows.map(() => new Set<number>());
    const offsets = new Map<number, number>();
    const checkFrame = (frame: number, mediaTime: number) => {
      ctx.drawImage(video, 0, 0, 480, 270);
      const centers = {} as Record<"landscape" | "portrait", { x: number; y: number }>;
      for (const mode of modes) {
        const band = templateBandRect(480, 270, mode);
        const data = ctx.getImageData(band.x, band.y, band.w, band.h).data;
        const key = sampleKeyColor(data, band.w, band.h);
        // 未提示の黒いCanvasはdarkProtectで全面前景となり、偽の中心(0.5, 0.5)を返す。
        // 外接矩形を測る前に、テンプレのグリーンバックが実際に描かれたことを確認する。
        expect(key[1] - Math.max(key[0], key[2]), `green background: frame=${frame}, ${mode}`).toBeGreaterThan(KEY_PARAMS.greenBoost);
        const rows = new Uint32Array(band.h), cols = new Uint32Array(band.w);
        for (let y = 0; y < band.h; y++) {
          for (let x = 0; x < band.w; x++) {
            const i = (y * band.w + x) * 4;
            if (keyAlpha(data[i]!, data[i + 1]!, data[i + 2]!, ...key) >= 0.5) { rows[y]!++; cols[x]!++; }
          }
        }
        const xs = [...cols.keys()].filter((x) => cols[x]! >= 3);
        const ys = [...rows.keys()].filter((y) => rows[y]! >= 3);
        expect(xs.length).toBeGreaterThan(0); expect(ys.length).toBeGreaterThan(0);
        const actual = { x: (xs[0]! + xs.at(-1)! + 1) / (2 * band.w), y: (ys[0]! + ys.at(-1)! + 1) / (2 * band.h) };
        centers[mode] = actual;
      }
      // WebKit CIのf=59の距離.122382326は、表の58→59の.122506737と対応。
      // 実測候補(.44375, .67037037)なら59との距離がCI値と一致し、58とは.002083。
      // PTSはffprobeでf/30を確認済み。mediaTimeとdrawImageのフレームの対応が
      // WebKitで1枚ずれる仮説に限って隣接候補を認める（座標誤差は.012のまま）。
      // Chromiumは同一フレーム必須。縦横は必ず同じ候補フレームに一致させる。
      const candidates = (server.browser === "webkit" ? [frame, frame - 1, frame + 1] : [frame])
        .filter((n) => n >= 0 && n < track.landscape.length)
        .map((n) => ({ frame: n, errors: modes.map((mode) => {
          const actual = centers[mode], measured = track[mode][n]!;
          return Math.hypot(actual.x - measured[0]!, actual.y - measured[1]!);
        }) }));
      const matched = candidates.reduce((best, candidate) => Math.max(...candidate.errors) < Math.max(...best.errors) ? candidate : best);
      expect(Math.max(...matched.errors), JSON.stringify({ frame, mediaTime, centers, candidates })).toBeLessThan(0.012);
      offsets.set(matched.frame - frame, (offsets.get(matched.frame - frame) ?? 0) + 1);
      for (const mode of modes) {
        const actual = centers[mode];
        const w = mode === "landscape" ? 640 : 360, h = mode === "landscape" ? 360 : 640;
        for (const size of ["standard", "1.2", "1.4"] as const) {
          const dest = characterDest(w, h, characterScale(mode, size), characterShiftY(h, mode), mode);
          // 内容に対応した時刻で写像を検査。デコーダの提示タイミングは製品の不変条件ではない。
          const iris = charaIrisCenter(matched.frame / track.fps, w, h, mode, size);
          // ポーズ境界の平滑化による差も含め、実キャラの外接矩形中心付近に収まる。
          expect(Math.hypot((iris.x - dest.x) / dest.w - actual.x, (iris.y - dest.y) / dest.h - actual.y)).toBeLessThan(0.065);
        }
      }
    };
    let callback = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
          try {
            // 30fpsのPTSを最近傍整数に戻し、浮動小数の境界誤差を避ける。
            const frame = Math.round(metadata.mediaTime * track.fps);
            expect(metadata.mediaTime * track.fps).toBeCloseTo(frame, 2);
            const window = windows.findIndex(([from, to]) => frame >= from && frame <= to);
            if (window >= 0) {
              checkFrame(frame, metadata.mediaTime);
              observed[window]!.add(frame);
            }
            if (frame >= windows.at(-1)![1]) resolve();
            else callback = video.requestVideoFrameCallback(onFrame);
          } catch (error) { reject(error); }
        };
        // play()前に登録し、初回の提示も取り逃さない。提示なしをtimeout成功にしない。
        callback = video.requestVideoFrameCallback(onFrame);
        video.play().catch(reject);
      });
      for (const [index, frames] of observed.entries()) {
        expect(frames.size, `presented frames in ${windows[index]!.join("..")} (${[...frames]})`).toBeGreaterThan(0);
      }
      console.info("track frame offsets", server.browser, Object.fromEntries(offsets));
    } finally {
      video.cancelVideoFrameCallback(callback);
      video.pause();
    }
  } finally {
    video.removeAttribute("src"); video.load();
    video.remove();
  }
});

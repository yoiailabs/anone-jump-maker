import { createCompositor } from "./compositor.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import {
  captureCanvasStream,
  combineStreams,
  downloadBlob,
  extensionForMime,
  pickRecorderMime,
  recordStream,
} from "./recorder.ts";
import type { CutTimeline } from "./timeline.ts";

type StatusKind = "idle" | "busy" | "error";

export async function boot(root: HTMLElement): Promise<void> {
  const timeline = await loadTimeline();
  const compositor = createCompositor();
  const video = createTemplateVideo();
  const audio = createAudioTap(video);

  let photos: LoadedPhoto[] = [];
  let playing = false;
  let recording = false;
  let raf = 0;
  let lastSlot = -1;

  root.innerHTML = `
    <div class="app">
      <header class="hero">
        <p class="eyebrow">よいらぼ試作</p>
        <h1>あのねジャンプ</h1>
        <p class="lede">写真を選ぶと、縦テンプレのジャンプに合わせて差し込みます。処理はすべてこの端末の中だけです。</p>
      </header>

      <section class="stage-wrap">
        <div class="stage" id="stage"></div>
        <p class="slot-meter" id="slotMeter">スロット — / ${timeline.slots.length}</p>
      </section>

      <section class="panel">
        <label class="file-btn">
          <input id="picker" type="file" accept="image/*" multiple />
          写真を選ぶ
        </label>
        <div class="thumbs" id="thumbs" hidden></div>
        <div class="actions">
          <button type="button" id="playBtn" class="btn ghost" disabled>プレビュー</button>
          <button type="button" id="saveBtn" class="btn" disabled>動画を保存</button>
        </div>
        <p class="status" id="status" data-kind="idle">写真を選んでプレビューできます</p>
      </section>

      <footer class="notes">
        <p>選んだ写真はサーバーに送らず、ブラウザ内だけで合成します。</p>
        <p>テンプレートはナナツカゼさんの YouTube Short「#あのねジャンプ 縦ver.テンプレート」に基づくファン試作です。権利関係の正式確認は今後行います。公式テンプレート配布はファン制作を想定しています。</p>
      </footer>
    </div>
  `;

  const stage = must(root, "#stage");
  const thumbs = must(root, "#thumbs");
  const slotMeter = must(root, "#slotMeter");
  const statusEl = must(root, "#status");
  const playBtn = must(root, "#playBtn") as HTMLButtonElement;
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;

  stage.append(compositor.canvas);
  document.body.append(video);

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const renderThumbs = () => {
    thumbs.hidden = photos.length === 0;
    thumbs.replaceChildren(
      ...photos.map((photo, index) => {
        const img = document.createElement("img");
        img.src = photo.objectUrl;
        img.alt = photo.name || `写真 ${index + 1}`;
        return img;
      }),
    );
  };

  const canUse = () => photos.length > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const refreshButtons = () => {
    playBtn.disabled = !canUse() || recording;
    saveBtn.disabled = !canUse() || recording;
    playBtn.textContent = playing ? "停止" : "プレビュー";
  };

  const paint = () => {
    const slot = compositor.draw(video, photos, timeline.slots);
    if (slot !== lastSlot) {
      lastSlot = slot;
      slotMeter.textContent = `スロット ${slot + 1} / ${timeline.slots.length}`;
    }
  };

  const loop = () => {
    paint();
    if (playing || recording) {
      raf = requestAnimationFrame(loop);
    }
  };

  const startLoop = async () => {
    await audio.resume();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  };

  const stopPlayback = () => {
    playing = false;
    video.pause();
    refreshButtons();
  };

  video.addEventListener("loadeddata", () => {
    paint();
    refreshButtons();
    setStatus(`テンプレ準備完了（${timeline.slots.length} カット）`);
  });
  video.addEventListener("ended", () => {
    if (!recording) {
      stopPlayback();
      paint();
      setStatus("プレビューが終わりました");
    }
  });

  picker.addEventListener("change", async () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    if (files.length === 0) return;
    setStatus("写真を読み込み中…", "busy");
    try {
      revokePhotos(photos);
      photos = await loadPhotos(files);
      renderThumbs();
      paint();
      refreshButtons();
      setStatus(
        photos.length === 0
          ? "画像ファイルを選んでください"
          : `${photos.length} 枚を読み込みました。足りないスロットは循環します。`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "読み込みに失敗しました", "error");
    }
  });

  playBtn.addEventListener("click", async () => {
    if (recording) return;
    if (playing) {
      stopPlayback();
      setStatus("停止しました");
      return;
    }
    try {
      video.currentTime = 0;
      video.muted = false;
      await video.play();
      playing = true;
      refreshButtons();
      setStatus("プレビュー中");
      await startLoop();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "再生できませんでした", "error");
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (recording || photos.length === 0) return;
    recording = true;
    playing = false;
    refreshButtons();
    setStatus("書き出し中… 画面を消さずにお待ちください", "busy");
    try {
      await audio.resume();
      video.pause();
      video.currentTime = 0;
      await waitForSeek(video);
      const canvasStream = captureCanvasStream(compositor.canvas, 30);
      const mixed = combineStreams(canvasStream, audio.stream);
      video.muted = false;
      const finished = whenEnded(video);
      const blobPromise = recordStream(mixed, finished);
      await video.play();
      await startLoop();
      const blob = await blobPromise;
      const mime = blob.type || pickRecorderMime();
      downloadBlob(blob, `anone-jump.${extensionForMime(mime)}`);
      setStatus(`保存しました（${extensionForMime(mime).toUpperCase()}）`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました", "error");
    } finally {
      recording = false;
      playing = false;
      video.pause();
      refreshButtons();
      paint();
    }
  });

  void video.load();
}

async function loadTimeline(): Promise<CutTimeline> {
  const response = await fetch("/template/cuts.json");
  if (!response.ok) {
    throw new Error("カット表を読み込めませんでした");
  }
  return (await response.json()) as CutTimeline;
}

function createTemplateVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = "/template/vertical.mp4";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.controls = false;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.className = "offscreen-video";
  return video;
}

function createAudioTap(video: HTMLVideoElement): {
  resume: () => Promise<void>;
  stream: MediaStream;
} {
  const Ctor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return { resume: async () => undefined, stream: new MediaStream() };
  }
  const ctx = new Ctor();
  const source = ctx.createMediaElementSource(video);
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  source.connect(ctx.destination);
  return {
    stream: dest.stream,
    resume: async () => {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
    },
  };
}

function whenEnded(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("ended", done);
      resolve();
    };
    video.addEventListener("ended", done);
  });
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  if (video.seekable.length === 0 || video.currentTime === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
  });
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

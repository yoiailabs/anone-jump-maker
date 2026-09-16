import { createCompositor } from "./compositor.ts";
import { EXPORT_FPS, exportJumpVideo } from "./export.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { downloadBlob } from "./recorder.ts";
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
      <div class="sky" aria-hidden="true">
        <span class="blob blob-lime"></span>
        <span class="blob blob-teal"></span>
        <span class="blob blob-coral"></span>
        <span class="wind"></span>
      </div>
      <header class="hero">
        <div class="breeze" aria-hidden="true"></div>
        <p class="eyebrow">#あのねジャンプ</p>
        <h1>あのねジャンプメーカー</h1>
        <p class="lede">写真を置くと、ジャンプの拍で入れ替わります。ベタ塗りの後ろだけ抜けて、線のキャラはそのまま。この端末の中だけの、小さな夏。</p>
      </header>

      <section class="stage-wrap">
        <div class="stage" id="stage"></div>
        <p class="empty-hint" id="emptyHint">まだ写真はありません。下から選ぶと、ここに色が入ります。</p>
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
        <p class="status" id="status" data-kind="idle">何枚でも。足りないカットはくり返します。</p>
      </section>

      <footer class="notes">
        <p>選んだ写真はどこにも送りません。ブラウザの中だけで重ねます。</p>
        <p>ファン制作です。</p>
      </footer>
    </div>
  `;

  const stage = must(root, "#stage");
  const thumbs = must(root, "#thumbs");
  const emptyHint = must(root, "#emptyHint");
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
    emptyHint.hidden = photos.length > 0;
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
    video.pause();
    refreshButtons();
    setStatus("書き出しを準備しています…", "busy");
    try {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : timeline.duration;
      const fps = timeline.fps && timeline.fps > 0 ? timeline.fps : EXPORT_FPS;
      const result = await exportJumpVideo({
        video,
        canvas: compositor.canvas,
        draw: paint,
        duration,
        fps,
        audioStream: audio.stream,
        resumeAudio: audio.resume,
        startLoop,
        onProgress: (progress) => {
          if (progress.mode === "offline") {
            setStatus(`生成中… ${progress.current} / ${progress.total}`, "busy");
            return;
          }
          setStatus("録画で保存しています… 画面を消さずにお待ちください", "busy");
        },
      });
      downloadBlob(result.blob, `anone-jump.${result.extension}`);
      setStatus(
        result.mode === "offline"
          ? `保存しました（${result.extension.toUpperCase()}・生成）`
          : `保存しました（${result.extension.toUpperCase()}・録画）`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました", "error");
    } finally {
      recording = false;
      playing = false;
      video.pause();
      video.muted = true;
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

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

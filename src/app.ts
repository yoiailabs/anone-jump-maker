import { createCompositor } from "./compositor.ts";
import { EXPORT_FPS, exportJumpVideo, seekVideo } from "./export.ts";
import { isAspectMode, isSwapStyle, TEMPLATES, type AspectMode, type SwapStyle } from "./layout.ts";
import { describePhotoCount, exportFileName } from "./modes.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { startVideoPaintLoop } from "./playback.ts";
import { playPauseLabel, PREVIEW_RESTART_LABEL, shouldSeekPreviewToStart } from "./preview.ts";
import { downloadBlob } from "./recorder.ts";
import { fetchGenerateCount, formatCountLabel, recordGenerate } from "./stats.ts";
import { shouldCountPreview } from "./stats-shared.ts";
import type { CutTimeline } from "./timeline.ts";

type StatusKind = "idle" | "busy" | "error";

export async function boot(root: HTMLElement): Promise<void> {
  const timelines = await loadTimelines();
  const compositor = createCompositor();
  const video = createTemplateVideo("portrait");

  let mode: AspectMode = "portrait";
  let swapStyle: SwapStyle = "jump";
  let photos: LoadedPhoto[] = [];
  let playing = false;
  let recording = false;
  let previewCounted = false;
  let playbackBusy = false;
  let playGen = 0;
  let suppressPlayUntil = 0;
  let stopLoop: (() => void) | null = null;
  let lastSlot = -1;

  root.innerHTML = `
    <div class="sky" aria-hidden="true">
      <span class="blob blob-lime"></span>
      <span class="blob blob-teal"></span>
      <span class="blob blob-coral"></span>
    </div>
    <div class="app">
      <header class="hero">
        <p class="eyebrow">#あのねジャンプ</p>
        <h1>あのねジャンプメーカー</h1>
        <p class="lede">写真を何枚か選択するだけで簡単にあのねジャンプ動画が作れます。動画生成はすべて端末内で完結するため、外部のサーバーに画像が送信されることはありません。</p>
        <p class="made-count" id="madeCount">—回作られたよ</p>
      </header>

      <div class="loop-wrap">
        <a
          class="loop-link"
          href="https://www.youtube.com/watch?v=M-IayQIR0XA"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="あのねのPVをYouTubeで開く（新しいタブ）"
        >
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcset="/jump-loop-still.png" />
            <img class="loop" src="/jump-loop.png" alt="" width="448" height="252" decoding="async" />
          </picture>
        </a>
      </div>

      <section class="panel">
        <fieldset class="aspect-field">
          <legend>動画の向き</legend>
          <div class="aspect-toggle" role="radiogroup" aria-label="動画の向き">
            <label>
              <input type="radio" name="aspect" value="portrait" checked />
              <span>縦</span>
            </label>
            <label>
              <input type="radio" name="aspect" value="landscape" />
              <span>横</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="aspect-field" id="swapField">
          <legend>エフェクト</legend>
          <div class="aspect-toggle" role="radiogroup" aria-label="エフェクト">
            <label>
              <input type="radio" name="swap" value="jump" checked />
              <span>ジャンプ</span>
            </label>
            <label>
              <input type="radio" name="swap" value="zoom" />
              <span>ズーム</span>
            </label>
          </div>
        </fieldset>
        <label class="file-btn">
          <input id="picker" type="file" accept="image/*" multiple />
          写真を選ぶ
        </label>
        <div class="thumbs" id="thumbs" hidden></div>
        <div class="actions">
          <button type="button" id="playBtn" class="btn ghost" disabled>プレビュー</button>
          <button type="button" id="saveBtn" class="btn" disabled>動画を保存</button>
        </div>
        <p class="status" id="status" data-kind="idle">何枚でも。テンプレは 10 枚を 32 カットに並べ直します。少なければ順にくり返します。</p>
      </section>

      <footer class="notes">
        <p>ファン制作です。</p>
      </footer>
    </div>
    <dialog class="preview-dialog" id="previewDialog" aria-labelledby="previewTitle">
      <div class="preview-sheet">
        <header class="preview-head">
          <h2 id="previewTitle">プレビュー</h2>
          <button type="button" id="closePreviewBtn" class="preview-close" aria-label="閉じる">×</button>
        </header>
        <div class="stage-wrap">
          <div class="stage" id="stage" data-aspect="portrait"></div>
        </div>
        <p class="slot-meter" id="slotMeter">スロット — / ${timelines.portrait.slots.length}</p>
        <p class="preview-state" id="previewState" aria-live="polite">停止中</p>
        <div class="preview-actions">
          <button type="button" id="modalPlayBtn" class="btn">${playPauseLabel(false)}</button>
          <button type="button" id="restartBtn" class="btn ghost">${PREVIEW_RESTART_LABEL}</button>
        </div>
      </div>
    </dialog>
  `;

  const stage = must(root, "#stage");
  const thumbs = must(root, "#thumbs");
  const slotMeter = must(root, "#slotMeter");
  const statusEl = must(root, "#status");
  const playBtn = must(root, "#playBtn") as HTMLButtonElement;
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const madeCount = must(root, "#madeCount");
  const previewDialog = must(root, "#previewDialog") as HTMLDialogElement;
  const closePreviewBtn = must(root, "#closePreviewBtn") as HTMLButtonElement;
  const modalPlayBtn = must(root, "#modalPlayBtn") as HTMLButtonElement;
  const restartBtn = must(root, "#restartBtn") as HTMLButtonElement;
  const previewState = must(root, "#previewState");
  const aspectInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="aspect"]')];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"]')];

  stage.append(compositor.canvas);
  document.body.append(video);

  const timeline = () => timelines[mode];

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const setMadeCount = (count: number | null) => {
    madeCount.textContent = formatCountLabel(count);
  };

  const renderThumbs = () => {
    thumbs.hidden = photos.length === 0;
    thumbs.replaceChildren(
      ...photos.map((photo, index) => {
        const img = document.createElement("img");
        img.src = photo.thumbUrl;
        img.alt = photo.name || `写真 ${index + 1}`;
        return img;
      }),
    );
  };

  const canUse = () => photos.length > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const isPreviewPlaying = () => playing || (!video.paused && !video.ended);

  const refreshButtons = () => {
    const ready = canUse();
    playBtn.disabled = recording || !ready;
    saveBtn.disabled = recording || !ready;
    modalPlayBtn.disabled = recording || !ready;
    restartBtn.disabled = recording || !ready;
    const active = isPreviewPlaying();
    modalPlayBtn.textContent = playPauseLabel(active);
    modalPlayBtn.setAttribute("aria-pressed", active ? "true" : "false");
    previewState.textContent = active ? "再生中" : "停止中";
    for (const input of aspectInputs) {
      input.disabled = recording;
    }
    for (const input of swapInputs) {
      input.disabled = recording;
    }
  };

  const paint = (time?: number) => {
    const cuts = timeline();
    const slot = compositor.draw(video, photos, cuts, time, swapStyle);
    if (slot !== lastSlot) {
      lastSlot = slot;
      slotMeter.textContent = `スロット ${slot + 1} / ${cuts.slots.length}`;
    }
  };

  const haltLoop = () => {
    stopLoop?.();
    stopLoop = null;
  };

  const startLoop = async () => {
    haltLoop();
    stopLoop = startVideoPaintLoop(video, paint);
  };

  const reportMade = async (partial: { action: "preview" | "save"; mime?: string }) => {
    const nextCount = await recordGenerate({
      action: partial.action,
      mime: partial.mime,
      width: compositor.canvas.width,
      height: compositor.canvas.height,
    });
    if (nextCount !== null) {
      setMadeCount(nextCount);
    }
  };

  const countPreviewStart = () => {
    if (!shouldCountPreview({ event: "start", recording, countedThisPlayback: previewCounted })) {
      return;
    }
    previewCounted = true;
    void reportMade({ action: "preview" });
  };

  const stopPlayback = () => {
    playGen += 1;
    playbackBusy = false;
    playing = false;
    previewCounted = false;
    haltLoop();
    video.pause();
    refreshButtons();
  };

  const pausePlayback = () => {
    playGen += 1;
    playbackBusy = false;
    playing = false;
    suppressPlayUntil = Date.now() + 350;
    haltLoop();
    video.pause();
    paint();
    refreshButtons();
    setStatus("一時停止しました");
  };

  const startPlayback = async (fromStart: boolean) => {
    if (recording || playbackBusy || !canUse()) return;
    if (!fromStart && Date.now() < suppressPlayUntil) return;
    playbackBusy = true;
    const gen = (playGen += 1);
    try {
      countPreviewStart();
      video.muted = false;
      video.volume = 1;
      if (
        shouldSeekPreviewToStart({
          fromStart,
          ended: video.ended,
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        })
      ) {
        await seekVideo(video, 0);
      }
      if (gen !== playGen) return;
      playing = true;
      refreshButtons();
      setStatus("プレビュー中");
      await startLoop();
      if (gen !== playGen) {
        video.pause();
        haltLoop();
        return;
      }
      await video.play();
      if (gen !== playGen) {
        video.pause();
        haltLoop();
      }
    } catch (error) {
      if (gen !== playGen) return;
      playing = false;
      previewCounted = false;
      haltLoop();
      refreshButtons();
      setStatus(error instanceof Error ? error.message : "再生できませんでした", "error");
    } finally {
      if (gen === playGen) playbackBusy = false;
    }
  };

  const openPreview = async () => {
    if (recording || !canUse() || previewDialog.open) return;
    previewDialog.showModal();
    try {
      video.muted = true;
      await seekVideo(video, 0);
      lastSlot = -1;
      paint();
    } catch {
      paint();
    }
    refreshButtons();
    modalPlayBtn.focus();
  };

  const closePreview = () => {
    if (previewDialog.open) {
      previewDialog.close();
    }
  };

  const applyAspect = (next: AspectMode) => {
    if (next === mode) return;
    stopPlayback();
    mode = next;
    compositor.setAspect(mode);
    stage.dataset.aspect = mode;
    lastSlot = -1;
    slotMeter.textContent = `スロット — / ${timeline().slots.length}`;
    video.src = TEMPLATES[mode].video;
    video.load();
    refreshButtons();
  };

  video.addEventListener("loadeddata", () => {
    paint();
    refreshButtons();
    setStatus(`テンプレ準備完了（${timeline().slots.length} カット）`);
  });
  video.addEventListener("ended", () => {
    if (!recording) {
      stopPlayback();
      paint();
      setStatus("プレビューが終わりました");
    }
  });

  for (const input of aspectInputs) {
    input.addEventListener("change", () => {
      if (recording || !input.checked || !isAspectMode(input.value)) return;
      applyAspect(input.value);
    });
  }

  for (const input of swapInputs) {
    input.addEventListener("change", () => {
      if (recording || !input.checked || !isSwapStyle(input.value)) return;
      swapStyle = input.value;
      if (!playing) {
        paint();
      }
    });
  }

  picker.addEventListener("change", async () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    if (files.length === 0) return;
    setStatus("写真を読み込み中…", "busy");
    try {
      revokePhotos(photos);
      photos = [];
      renderThumbs();
      photos = await loadPhotos(files, {
        onProgress: (current, total) => {
          setStatus(`写真を読み込み中… ${current} / ${total}`, "busy");
        },
      });
      renderThumbs();
      paint();
      refreshButtons();
      setStatus(
        photos.length === 0
          ? "画像ファイルを選んでください"
          : `${photos.length} 枚を読み込みました。大きな写真は書き出し用に縮小しています。${describePhotoCount(photos.length)}`,
      );
    } catch (error) {
      renderThumbs();
      paint();
      refreshButtons();
      setStatus(error instanceof Error ? error.message : "読み込みに失敗しました", "error");
    }
  });

  playBtn.addEventListener("click", () => {
    void openPreview();
  });

  const togglePreviewPlay = () => {
    if (isPreviewPlaying()) {
      pausePlayback();
      return;
    }
    void startPlayback(false);
  };

  let playToggleFromPointer = false;
  modalPlayBtn.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    playToggleFromPointer = true;
    togglePreviewPlay();
  });
  modalPlayBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (playToggleFromPointer) {
      playToggleFromPointer = false;
      return;
    }
    togglePreviewPlay();
  });

  restartBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void startPlayback(true);
  });

  closePreviewBtn.addEventListener("click", () => {
    closePreview();
  });

  previewDialog.addEventListener("click", (event) => {
    if (event.target !== previewDialog) return;
    const rect = previewDialog.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!inside) closePreview();
  });

  previewDialog.addEventListener("close", () => {
    stopPlayback();
    video.muted = true;
  });

  saveBtn.addEventListener("click", async () => {
    if (recording || photos.length === 0) return;
    closePreview();
    recording = true;
    playing = false;
    previewCounted = false;
    video.pause();
    refreshButtons();
    setStatus("書き出しを準備しています…", "busy");
    try {
      const cuts = timeline();
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : cuts.duration;
      const fps = cuts.fps && cuts.fps > 0 ? cuts.fps : EXPORT_FPS;
      const result = await exportJumpVideo({
        video,
        canvas: compositor.canvas,
        draw: paint,
        duration,
        fps,
        onProgress: (progress) => {
          setStatus(`生成中… ${progress.current} / ${progress.total}`, "busy");
        },
      });
      downloadBlob(result.blob, exportFileName(mode, swapStyle, result.extension));
      setStatus(`保存しました（${result.extension.toUpperCase()}・生成）`);
      await reportMade({ action: "save", mime: result.mime });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました", "error");
    } finally {
      recording = false;
      playing = false;
      previewCounted = false;
      haltLoop();
      video.pause();
      video.muted = true;
      refreshButtons();
      paint();
    }
  });

  void video.load();
  void fetchGenerateCount().then(setMadeCount);
}

async function loadTimelines(): Promise<Record<AspectMode, CutTimeline>> {
  const [portrait, landscape] = await Promise.all([
    loadTimeline(TEMPLATES.portrait.cuts),
    loadTimeline(TEMPLATES.landscape.cuts),
  ]);
  return { portrait, landscape };
}

async function loadTimeline(url: string): Promise<CutTimeline> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("カット表を読み込めませんでした");
  }
  return (await response.json()) as CutTimeline;
}

function createTemplateVideo(mode: AspectMode): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = TEMPLATES[mode].video;
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

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

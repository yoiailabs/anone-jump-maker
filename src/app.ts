import { trackEvent, VIDEO_PREVIEW_EVENT, VIDEO_SAVE_EVENT, videoEventParams } from "./analytics.ts";
import { createCompositor } from "./compositor.ts";
import { EXPORT_FPS, exportJumpVideo, seekVideo } from "./export.ts";
import { isAspectMode, isSwapStyle, TEMPLATES, type AspectMode, type SwapStyle } from "./layout.ts";
import { linkBannersHtml } from "./links.ts";
import { exportFileName } from "./modes.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { startVideoPaintLoop } from "./playback.ts";
import {
  playPauseLabel,
  PREVIEW_MUTED_DEFAULT,
  PREVIEW_RESTART_LABEL,
  previewSoundLabel,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
} from "./preview.ts";
import { downloadBlob } from "./recorder.ts";
import {
  copyTextToClipboard,
  openExternalTab,
  SHARE_HASHTAG,
  SHARE_TEXT,
  shareAppUrl,
  shareJumpVideo,
  toShareFile,
} from "./share.ts";
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
  let previewTracked = false;
  let previewMuted = PREVIEW_MUTED_DEFAULT;
  let playbackBusy = false;
  let playGen = 0;
  let suppressPlayUntil = 0;
  let stopLoop: (() => void) | null = null;
  let lastSlot = -1;
  let savedVideo: File | null = null;
  let aspectResume: { play: boolean; time: number; tracked: boolean } | null = null;

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
        <p class="lede">写真を何枚か選択するだけで簡単に「あのねジャンプ」動画が作れます。<br />動画生成はすべて端末内で完結するため、外部のサーバーに画像が送信されることはありません。<br />※ファン制作の非公式アプリです。</p>
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
          <input id="picker" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/*" multiple />
          写真を選ぶ
        </label>
        <div class="thumbs" id="thumbs" hidden></div>
        <div class="actions">
          <button type="button" id="playBtn" class="btn ghost" disabled>プレビュー</button>
          <button type="button" id="saveBtn" class="btn" disabled>動画を保存</button>
        </div>
        <p class="status" id="status" data-kind="idle">何枚でも。テンプレは 10 枚を 32 カットに並べ直します。少なければ順にくり返します。</p>
      </section>

      <div class="share-wrap">
        <button type="button" id="shareBtn" class="btn share">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          ${SHARE_HASHTAG} で X に投稿
        </button>
        <button type="button" id="shareAppBtn" class="btn share-app">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 3v10M8.2 6.8 12 3l3.8 3.8M5 13v6.2A1.8 1.8 0 0 0 6.8 21h10.4A1.8 1.8 0 0 0 19 19.2V13"
              fill="none"
              stroke="currentColor"
              stroke-width="2.1"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          このアプリを共有する
        </button>
      </div>

      <footer class="notes">
        <nav class="links" aria-labelledby="linksTitle">
          <p class="links-title" id="linksTitle">ナナツカゼさん公式</p>
          <ul class="link-banners">${linkBannersHtml()}</ul>
        </nav>
      </footer>
    </div>
    <dialog class="preview-dialog" id="previewDialog" aria-labelledby="previewTitle">
      <div class="preview-sheet">
        <header class="preview-head">
          <h2 id="previewTitle">プレビュー</h2>
          <button type="button" id="closePreviewBtn" class="preview-close" aria-label="閉じる">×</button>
        </header>
        <div class="preview-options">
          <fieldset class="aspect-field preview-field">
            <legend>向き</legend>
            <div class="aspect-toggle preview-toggle" role="radiogroup" aria-label="プレビューの向き">
              <label>
                <input type="radio" name="preview-aspect" value="portrait" checked />
                <span>縦</span>
              </label>
              <label>
                <input type="radio" name="preview-aspect" value="landscape" />
                <span>横</span>
              </label>
            </div>
          </fieldset>
          <fieldset class="aspect-field preview-field">
            <legend>エフェクト</legend>
            <div class="aspect-toggle preview-toggle" role="radiogroup" aria-label="プレビューのエフェクト">
              <label>
                <input type="radio" name="preview-swap" value="jump" checked />
                <span>ジャンプ</span>
              </label>
              <label>
                <input type="radio" name="preview-swap" value="zoom" />
                <span>ズーム</span>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="stage-wrap">
          <button
            type="button"
            class="stage"
            id="stage"
            data-aspect="portrait"
            aria-pressed="false"
            aria-label="プレビュー。クリックで再生と一時停止"
          >
            <span class="stage-play-hint" aria-hidden="true"></span>
          </button>
        </div>
        <p class="slot-meter" id="slotMeter">スロット — / ${timelines.portrait.slots.length}</p>
        <p class="preview-state" id="previewState" aria-live="polite">停止中</p>
        <div class="preview-actions">
          <button type="button" id="modalPlayBtn" class="btn">${playPauseLabel(false)}</button>
          <button type="button" id="restartBtn" class="btn ghost">${PREVIEW_RESTART_LABEL}</button>
          <button type="button" id="muteBtn" class="btn ghost" aria-pressed="${previewMuted ? "false" : "true"}">${previewSoundLabel(previewMuted)}</button>
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
  const shareBtn = must(root, "#shareBtn") as HTMLButtonElement;
  const shareAppBtn = must(root, "#shareAppBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const previewDialog = must(root, "#previewDialog") as HTMLDialogElement;
  const closePreviewBtn = must(root, "#closePreviewBtn") as HTMLButtonElement;
  const modalPlayBtn = must(root, "#modalPlayBtn") as HTMLButtonElement;
  const restartBtn = must(root, "#restartBtn") as HTMLButtonElement;
  const muteBtn = must(root, "#muteBtn") as HTMLButtonElement;
  const previewState = must(root, "#previewState");
  const aspectInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="aspect"], input[name="preview-aspect"]'),
  ];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"], input[name="preview-swap"]')];

  stage.prepend(compositor.canvas);
  compositor.canvas.setAttribute("aria-hidden", "true");
  compositor.canvas.removeAttribute("aria-label");
  document.body.append(video);

  const timeline = () => timelines[mode];

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const syncAspectRadios = (value: AspectMode) => {
    for (const input of aspectInputs) {
      input.checked = input.value === value;
    }
  };

  const syncSwapRadios = (value: SwapStyle) => {
    for (const input of swapInputs) {
      input.checked = input.value === value;
    }
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
    muteBtn.disabled = recording;
    const active = isPreviewPlaying();
    modalPlayBtn.textContent = playPauseLabel(active);
    modalPlayBtn.setAttribute("aria-pressed", active ? "true" : "false");
    stage.setAttribute("aria-pressed", active ? "true" : "false");
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

  const applyPreviewMute = () => {
    video.muted = previewMuted;
    video.volume = 1;
    muteBtn.textContent = previewSoundLabel(previewMuted);
    muteBtn.setAttribute("aria-pressed", previewMuted ? "false" : "true");
  };

  const analyticsParams = () => videoEventParams(mode, swapStyle);

  const trackPreviewStart = () => {
    if (!shouldTrackPreviewStart({ event: "start", recording, trackedThisPlayback: previewTracked })) {
      return;
    }
    previewTracked = true;
    trackEvent(VIDEO_PREVIEW_EVENT, analyticsParams());
  };

  const stopPlayback = () => {
    playGen += 1;
    playbackBusy = false;
    playing = false;
    previewTracked = false;
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
      trackPreviewStart();
      applyPreviewMute();
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
        return;
      }
      video.blur();
      modalPlayBtn.focus();
    } catch (error) {
      if (gen !== playGen) return;
      playing = false;
      previewTracked = false;
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
    lastSlot = -1;
    paint();
    await startPlayback(true);
  };

  const closePreview = () => {
    if (previewDialog.open) {
      previewDialog.close();
    }
  };

  const applyAspect = (next: AspectMode) => {
    if (next === mode) return;
    const inPreview = previewDialog.open;
    aspectResume = inPreview
      ? { play: isPreviewPlaying(), time: video.currentTime, tracked: previewTracked }
      : null;
    playGen += 1;
    playbackBusy = false;
    playing = false;
    haltLoop();
    video.pause();
    if (!inPreview) {
      previewTracked = false;
    }
    mode = next;
    compositor.setAspect(mode);
    stage.dataset.aspect = mode;
    lastSlot = -1;
    slotMeter.textContent = `スロット — / ${timeline().slots.length}`;
    syncAspectRadios(mode);
    video.src = TEMPLATES[mode].video;
    video.load();
    refreshButtons();
  };

  const applySwap = (next: SwapStyle) => {
    if (next === swapStyle) return;
    swapStyle = next;
    syncSwapRadios(swapStyle);
    paint();
  };

  video.addEventListener("loadeddata", () => {
    paint();
    refreshButtons();
    if (!recording) {
      setStatus(`テンプレ準備完了（${timeline().slots.length} カット）`);
    }
    const resume = aspectResume;
    aspectResume = null;
    if (!resume || !previewDialog.open || recording) return;
    previewTracked = resume.tracked;
    void (async () => {
      try {
        await seekVideo(video, resume.time);
        lastSlot = -1;
        paint();
        if (resume.play) {
          await startPlayback(false);
        } else {
          refreshButtons();
        }
      } catch {
        paint();
        refreshButtons();
      }
    })();
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
      applySwap(input.value);
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
          : `${photos.length} 枚を読み込みました`,
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
    if (isPreviewPlaying() || playbackBusy) {
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

  previewDialog.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Node) || !stage.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      togglePreviewPlay();
    },
    true,
  );

  restartBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void startPlayback(true);
  });

  muteBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    previewMuted = !previewMuted;
    applyPreviewMute();
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
    previewTracked = false;
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
      const filename = exportFileName(mode, swapStyle, result.extension);
      downloadBlob(result.blob, filename);
      savedVideo = toShareFile(result.blob, filename);
      setStatus(`保存しました（${result.extension.toUpperCase()}・生成）。${SHARE_TEXT} を付けて X に投稿できます。`);
      trackEvent(VIDEO_SAVE_EVENT, analyticsParams());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存に失敗しました", "error");
    } finally {
      recording = false;
      playing = false;
      previewTracked = false;
      haltLoop();
      video.pause();
      video.muted = true;
      refreshButtons();
      paint();
    }
  });

  shareBtn.addEventListener("click", async () => {
    const outcome = await shareJumpVideo({
      file: savedVideo,
      navigator: typeof navigator === "undefined" ? undefined : navigator,
      openUrl: (url) => openExternalTab(url, window),
    });
    if (outcome === "files") {
      setStatus(`${SHARE_TEXT} を付けた動画を共有先に渡しました`);
    } else if (outcome === "intent") {
      setStatus("X の投稿画面を開きました。保存した動画を添付して投稿してください。");
    } else if (outcome === "blocked") {
      setStatus("ブラウザが新しいタブを塞いでいます。ポップアップを許可してください。", "error");
    } else {
      setStatus("投稿をやめました");
    }
  });

  shareAppBtn.addEventListener("click", async () => {
    const outcome = await shareAppUrl({
      navigator: typeof navigator === "undefined" ? undefined : navigator,
      copyText: (text) =>
        copyTextToClipboard(
          text,
          typeof navigator === "undefined" ? undefined : navigator.clipboard,
        ),
    });
    if (outcome === "shared") {
      setStatus("このアプリのリンクを共有先に渡しました");
    } else if (outcome === "copied") {
      setStatus("このアプリの URL をコピーしました");
    } else if (outcome === "cancelled") {
      setStatus("共有をやめました");
    } else {
      setStatus("このブラウザでは共有できません。https://anone.yoiailabs.com をコピーしてください。", "error");
    }
  });

  void video.load();
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
  video.tabIndex = -1;
  video.className = "offscreen-video";
  return video;
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

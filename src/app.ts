import { trackEvent, VIDEO_PREVIEW_EVENT, VIDEO_SAVE_EVENT, videoEventParams } from "./analytics.ts";
import { createCompositor } from "./compositor.ts";
import { EXPORT_FPS, exportJumpVideo, seekVideo } from "./export.ts";
import {
  actionAvailability,
  GENERATE_PHOTOS_HINT,
  GENERATE_PREPARE_STATUS,
  GENERATE_READY_STATUS,
  GENERATE_STALE_STATUS,
  generateButtonLabel,
  generateProgressText,
  generationErrorMessage,
  isArtifactCurrent,
  photosLoadedStatus,
  revokeGeneratedArtifact,
  settingsFingerprint,
  type GeneratedArtifact,
} from "./generate.ts";
import {
  DEFAULT_ASPECT,
  isAspectMode,
  isImageFilter,
  isSwapStyle,
  TEMPLATES,
  type AspectMode,
  type ImageFilter,
  type SwapStyle,
} from "./layout.ts";
import { linkBannersHtml } from "./links.ts";
import { exportFileName } from "./modes.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import {
  muteButtonHtml,
  playPauseButtonHtml,
  PREVIEW_MUTED_DEFAULT,
  restartButtonHtml,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
} from "./preview.ts";
import { hydrateReactionEmbed, reactionEmbedHtml } from "./reactions.ts";
import { downloadBlob } from "./recorder.ts";
import { reportError } from "./sentry.ts";
import { copyTextToClipboard, SHARE_TEXT, shareAppUrl } from "./share.ts";
import type { CutTimeline } from "./timeline.ts";
import wasmUrl from "./wasm/pixel.wasm?url";
import { loadPixelWasm } from "./pixel-wasm.ts";

type StatusKind = "idle" | "busy" | "error";

export async function boot(root: HTMLElement): Promise<void> {
  const timelines = await loadTimelines();
  await loadPixelWasm(wasmUrl);
  const compositor = createCompositor();
  const template = createTemplateVideo(DEFAULT_ASPECT);
  const resultVideo = createResultVideo();

  let mode: AspectMode = DEFAULT_ASPECT;
  let swapStyle: SwapStyle = "jump";
  let imageFilter: ImageFilter = "none";
  let photos: LoadedPhoto[] = [];
  let playing = false;
  let generating = false;
  let artifact: GeneratedArtifact | null = null;
  let previewTracked = false;
  let previewMuted = PREVIEW_MUTED_DEFAULT;
  let playbackBusy = false;
  let playGen = 0;
  let suppressPlayUntil = 0;
  let generateGen = 0;

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
        <label class="file-btn">
          <input id="picker" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/*" multiple />
          写真を選ぶ
        </label>
        <div class="thumbs" id="thumbs" hidden></div>
        <fieldset class="aspect-field">
          <legend>動画の向き</legend>
          <div class="aspect-toggle" role="radiogroup" aria-label="動画の向き">
            <label>
              <input type="radio" name="aspect" value="landscape" checked />
              <span>横</span>
            </label>
            <label>
              <input type="radio" name="aspect" value="portrait" />
              <span>縦</span>
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
        <fieldset class="aspect-field" id="filterField">
          <legend>フィルター</legend>
          <div class="aspect-toggle cols-3" role="radiogroup" aria-label="フィルター">
            <label>
              <input type="radio" name="filter" value="none" checked />
              <span>なし</span>
            </label>
            <label>
              <input type="radio" name="filter" value="blur-weak" />
              <span>ブラー(弱)</span>
            </label>
            <label>
              <input type="radio" name="filter" value="blur-strong" />
              <span>ブラー(強)</span>
            </label>
          </div>
        </fieldset>
        <div class="actions">
          <button type="button" id="generateBtn" class="btn" disabled>${generateButtonLabel(false)}</button>
          <button type="button" id="playBtn" class="btn ghost" disabled>プレビュー</button>
          <button type="button" id="saveBtn" class="btn ghost" disabled>動画を保存</button>
        </div>
        <p class="status" id="status" data-kind="idle">${GENERATE_PHOTOS_HINT}</p>
      </section>

      <div class="share-wrap">
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
          共有する
        </button>
        <div class="hashtag-copy">
          <button type="button" id="copyHashtagsBtn" class="btn copy-hashtags" aria-describedby="hashtagCopyHint">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect
                x="8.2"
                y="8.2"
                width="11.5"
                height="13"
                rx="2"
                fill="none"
                stroke="currentColor"
                stroke-width="2.1"
              />
              <path
                d="M15.8 8.2V6.4A1.8 1.8 0 0 0 14 4.6H6.4A1.8 1.8 0 0 0 4.6 6.4V18A1.8 1.8 0 0 0 6.4 19.8H8.2"
                fill="none"
                stroke="currentColor"
                stroke-width="2.1"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            ハッシュタグをコピー
          </button>
          <p class="hashtag-copy-hint" id="hashtagCopyHint">${SHARE_TEXT}</p>
        </div>
      </div>

      <footer class="notes">
        <nav class="links" aria-labelledby="linksTitle">
          <p class="links-title" id="linksTitle">ナナツカゼさん公式</p>
          <ul class="link-banners">${linkBannersHtml()}</ul>
        </nav>
        <section class="reactions" aria-labelledby="reactionsTitle">
          <h2 class="reactions-title" id="reactionsTitle">反応</h2>
          <div class="reactions-embed" id="reactionsEmbed">${reactionEmbedHtml()}</div>
        </section>
      </footer>
    </div>
    <dialog class="preview-dialog" id="previewDialog" aria-labelledby="previewTitle">
      <div class="preview-sheet">
        <header class="preview-head">
          <h2 id="previewTitle">プレビュー</h2>
          <button type="button" id="closePreviewBtn" class="preview-close" aria-label="閉じる">×</button>
        </header>
        <div class="stage-wrap">
          <button
            type="button"
            class="stage"
            id="stage"
            data-aspect="${DEFAULT_ASPECT}"
            aria-pressed="false"
            aria-label="プレビュー。クリックで再生と一時停止"
          >
            <span class="stage-play-hint" aria-hidden="true"></span>
          </button>
        </div>
        <p class="preview-state" id="previewState" aria-live="polite">停止中</p>
        <div class="preview-actions">
          <button type="button" id="modalPlayBtn" class="btn">${playPauseButtonHtml(false)}</button>
          <button type="button" id="restartBtn" class="btn ghost">${restartButtonHtml()}</button>
          <button type="button" id="muteBtn" class="btn ghost" aria-pressed="${previewMuted ? "false" : "true"}">${muteButtonHtml(previewMuted)}</button>
        </div>
      </div>
    </dialog>
  `;

  const stage = must(root, "#stage");
  const thumbs = must(root, "#thumbs");
  const statusEl = must(root, "#status");
  const generateBtn = must(root, "#generateBtn") as HTMLButtonElement;
  const playBtn = must(root, "#playBtn") as HTMLButtonElement;
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const copyHashtagsBtn = must(root, "#copyHashtagsBtn") as HTMLButtonElement;
  const shareAppBtn = must(root, "#shareAppBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const previewDialog = must(root, "#previewDialog") as HTMLDialogElement;
  const closePreviewBtn = must(root, "#closePreviewBtn") as HTMLButtonElement;
  const modalPlayBtn = must(root, "#modalPlayBtn") as HTMLButtonElement;
  const restartBtn = must(root, "#restartBtn") as HTMLButtonElement;
  const muteBtn = must(root, "#muteBtn") as HTMLButtonElement;
  const previewState = must(root, "#previewState");
  const aspectInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="aspect"]')];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"]')];
  const filterInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="filter"]')];

  stage.prepend(resultVideo);
  document.body.append(template);

  const timeline = () => timelines[mode];

  const currentSettings = () => ({
    aspect: mode,
    swap: swapStyle,
    filter: imageFilter,
    photoIds: photos.map((photo) => photo.id),
  });

  const hasCurrentArtifact = () => isArtifactCurrent(artifact?.key, currentSettings());

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const setErrorStatus = (error: unknown, fallback: string) => {
    reportError(error);
    setStatus(generationErrorMessage(error, fallback), "error");
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

  const syncFilterRadios = (value: ImageFilter) => {
    for (const input of filterInputs) {
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

  const templateReady = () => template.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const isPreviewPlaying = () => playing || (!resultVideo.paused && !resultVideo.ended);

  const refreshButtons = () => {
    const actions = actionAvailability({
      generating,
      photosReady: photos.length > 0,
      templateReady: templateReady(),
      hasCurrentArtifact: hasCurrentArtifact(),
    });
    generateBtn.disabled = !actions.canGenerate;
    generateBtn.textContent = generateButtonLabel(hasCurrentArtifact());
    playBtn.disabled = !actions.canPreview;
    saveBtn.disabled = !actions.canSave;
    modalPlayBtn.disabled = generating || !hasCurrentArtifact();
    restartBtn.disabled = generating || !hasCurrentArtifact();
    muteBtn.disabled = generating;
    const active = isPreviewPlaying();
    modalPlayBtn.innerHTML = playPauseButtonHtml(active);
    modalPlayBtn.setAttribute("aria-pressed", active ? "true" : "false");
    stage.setAttribute("aria-pressed", active ? "true" : "false");
    stage.dataset.aspect = mode;
    previewState.textContent = active ? "再生中" : "停止中";
    picker.disabled = generating;
    for (const input of aspectInputs) input.disabled = generating;
    for (const input of swapInputs) input.disabled = generating;
    for (const input of filterInputs) input.disabled = generating;
  };

  const applyPreviewMute = () => {
    resultVideo.muted = previewMuted;
    resultVideo.volume = 1;
    muteBtn.innerHTML = muteButtonHtml(previewMuted);
    muteBtn.setAttribute("aria-pressed", previewMuted ? "false" : "true");
  };

  const analyticsParams = () => videoEventParams(mode, swapStyle);

  const trackPreviewStart = () => {
    if (!shouldTrackPreviewStart({ event: "start", recording: generating, trackedThisPlayback: previewTracked })) {
      return;
    }
    previewTracked = true;
    trackEvent(VIDEO_PREVIEW_EVENT, analyticsParams());
  };

  const bindResultVideo = () => {
    if (!artifact) {
      resultVideo.removeAttribute("src");
      resultVideo.load();
      return;
    }
    if (resultVideo.src !== artifact.url) {
      resultVideo.src = artifact.url;
    }
    stage.dataset.aspect = mode;
  };

  const dropArtifact = (status?: string) => {
    if (!artifact) return;
    revokeGeneratedArtifact(artifact);
    artifact = null;
    bindResultVideo();
    if (status) setStatus(status);
  };

  const invalidateArtifact = () => {
    if (!artifact) return;
    closePreview();
    dropArtifact(GENERATE_STALE_STATUS);
    refreshButtons();
  };

  const stopPlayback = () => {
    playGen += 1;
    playbackBusy = false;
    playing = false;
    previewTracked = false;
    resultVideo.pause();
    refreshButtons();
  };

  const pausePlayback = () => {
    playGen += 1;
    playbackBusy = false;
    playing = false;
    suppressPlayUntil = Date.now() + 350;
    resultVideo.pause();
    refreshButtons();
    setStatus("一時停止しました");
  };

  const startPlayback = async (fromStart: boolean) => {
    if (generating || playbackBusy || !hasCurrentArtifact()) return;
    if (!fromStart && Date.now() < suppressPlayUntil) return;
    playbackBusy = true;
    const gen = (playGen += 1);
    try {
      bindResultVideo();
      trackPreviewStart();
      applyPreviewMute();
      if (
        shouldSeekPreviewToStart({
          fromStart,
          ended: resultVideo.ended,
          currentTime: resultVideo.currentTime,
          duration: Number.isFinite(resultVideo.duration) ? resultVideo.duration : 0,
        })
      ) {
        await seekVideo(resultVideo, 0);
      }
      if (gen !== playGen) return;
      playing = true;
      refreshButtons();
      setStatus("プレビュー中");
      try {
        await resultVideo.play();
      } catch (error) {
        if (!previewMuted) {
          previewMuted = true;
          applyPreviewMute();
          await resultVideo.play();
          setStatus("ブラウザが音声付き自動再生を止めました。音声オフで再生しています。");
        } else {
          throw error;
        }
      }
      if (gen !== playGen) {
        resultVideo.pause();
        return;
      }
      resultVideo.blur();
      modalPlayBtn.focus();
    } catch (error) {
      if (gen !== playGen) return;
      playing = false;
      previewTracked = false;
      refreshButtons();
      setErrorStatus(error, "再生できませんでした");
    } finally {
      if (gen === playGen) playbackBusy = false;
    }
  };

  const openPreview = async () => {
    if (generating || !hasCurrentArtifact() || previewDialog.open) return;
    try {
      bindResultVideo();
      previewDialog.showModal();
      await startPlayback(true);
    } catch (error) {
      setErrorStatus(error, "プレビューを開けませんでした");
    }
  };

  const closePreview = () => {
    if (previewDialog.open) {
      previewDialog.close();
    }
  };

  const applyAspect = (next: AspectMode) => {
    if (next === mode) return;
    closePreview();
    stopPlayback();
    mode = next;
    compositor.setAspect(mode);
    stage.dataset.aspect = mode;
    syncAspectRadios(mode);
    template.src = TEMPLATES[mode].video;
    template.load();
    invalidateArtifact();
    refreshButtons();
  };

  const applySwap = (next: SwapStyle) => {
    if (next === swapStyle) return;
    swapStyle = next;
    syncSwapRadios(swapStyle);
    invalidateArtifact();
  };

  const applyFilter = (next: ImageFilter) => {
    if (next === imageFilter) return;
    imageFilter = next;
    syncFilterRadios(imageFilter);
    invalidateArtifact();
  };

  const paintFrame = (time?: number) => {
    compositor.draw(template, photos, timeline(), time, swapStyle, imageFilter);
  };

  const runGenerate = async () => {
    if (generating || photos.length === 0 || !templateReady()) return;
    closePreview();
    generating = true;
    playing = false;
    previewTracked = false;
    resultVideo.pause();
    const gen = (generateGen += 1);
    refreshButtons();
    setStatus(GENERATE_PREPARE_STATUS, "busy");
    try {
      const cuts = timeline();
      const duration =
        Number.isFinite(template.duration) && template.duration > 0 ? template.duration : cuts.duration;
      const fps = cuts.fps && cuts.fps > 0 ? cuts.fps : EXPORT_FPS;
      const result = await exportJumpVideo({
        video: template,
        canvas: compositor.canvas,
        draw: paintFrame,
        duration,
        fps,
        onProgress: (progress) => {
          setStatus(generateProgressText(progress.current, progress.total), "busy");
        },
      });
      if (gen !== generateGen) return;
      revokeGeneratedArtifact(artifact);
      const filename = exportFileName(mode, swapStyle, result.extension, imageFilter);
      artifact = {
        ...result,
        filename,
        url: URL.createObjectURL(result.blob),
        key: settingsFingerprint(currentSettings()),
      };
      bindResultVideo();
      setStatus(GENERATE_READY_STATUS);
    } catch (error) {
      if (gen !== generateGen) return;
      setErrorStatus(error, "生成に失敗しました");
    } finally {
      if (gen === generateGen) {
        generating = false;
        template.pause();
        template.muted = true;
        refreshButtons();
      }
    }
  };

  template.addEventListener("loadeddata", () => {
    refreshButtons();
    if (generating) return;
    if (hasCurrentArtifact()) {
      setStatus(GENERATE_READY_STATUS);
    } else if (photos.length > 0) {
      setStatus(photosLoadedStatus(photos.length));
    } else {
      setStatus(`テンプレ準備完了（${timeline().slots.length} カット）`);
    }
  });
  template.addEventListener("error", () => {
    if (generating) return;
    const code = template.error?.code;
    setErrorStatus(
      new Error(code != null ? `テンプレ動画を読み込めませんでした (${code})` : "テンプレ動画を読み込めませんでした"),
      "テンプレ動画を読み込めませんでした",
    );
    refreshButtons();
  });

  resultVideo.addEventListener("ended", () => {
    if (generating) return;
    stopPlayback();
    setStatus("プレビューが終わりました");
  });
  resultVideo.addEventListener("error", () => {
    if (generating || !artifact) return;
    setErrorStatus(new Error("生成した動画を再生できませんでした"), "生成した動画を再生できませんでした");
    refreshButtons();
  });

  for (const input of aspectInputs) {
    input.addEventListener("change", () => {
      if (generating || !input.checked || !isAspectMode(input.value)) return;
      applyAspect(input.value);
    });
  }

  for (const input of swapInputs) {
    input.addEventListener("change", () => {
      if (generating || !input.checked || !isSwapStyle(input.value)) return;
      applySwap(input.value);
    });
  }

  for (const input of filterInputs) {
    input.addEventListener("change", () => {
      if (generating || !input.checked || !isImageFilter(input.value)) return;
      applyFilter(input.value);
    });
  }

  picker.addEventListener("change", async () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    if (files.length === 0) return;
    closePreview();
    dropArtifact();
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
      refreshButtons();
      setStatus(photosLoadedStatus(photos.length));
    } catch (error) {
      renderThumbs();
      refreshButtons();
      setErrorStatus(error, "読み込みに失敗しました");
    }
  });

  generateBtn.addEventListener("click", () => {
    void runGenerate();
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
    resultVideo.muted = true;
  });

  saveBtn.addEventListener("click", () => {
    if (generating || !artifact || !hasCurrentArtifact()) return;
    try {
      downloadBlob(artifact.blob, artifact.filename);
      setStatus(`保存しました（${artifact.extension.toUpperCase()}・生成）。ハッシュタグをコピーして X に投稿できます。`);
      trackEvent(VIDEO_SAVE_EVENT, analyticsParams());
    } catch (error) {
      setErrorStatus(error, "保存に失敗しました");
    }
  });

  copyHashtagsBtn.addEventListener("click", async () => {
    const copied = await copyTextToClipboard(
      SHARE_TEXT,
      typeof navigator === "undefined" ? undefined : navigator.clipboard,
    );
    if (copied) {
      setStatus("ハッシュタグをコピーしました");
    } else {
      setStatus(`このブラウザではコピーできません。${SHARE_TEXT} を手でコピーしてください。`, "error");
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

  void template.load();
  hydrateReactionEmbed(must(root, "#reactionsEmbed"));
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

function createResultVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.controls = false;
  video.tabIndex = -1;
  video.className = "stage-video";
  video.setAttribute("aria-hidden", "true");
  return video;
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

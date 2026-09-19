import { trackEvent, VIDEO_PREVIEW_EVENT, VIDEO_SAVE_EVENT, videoEventParams } from "./analytics.ts";
import { PREVIEW_RESOLUTION_SCALE } from "./canvas-size.ts";
import { createCompositor, type CharacterFrame } from "./compositor.ts";
import { readPreviewBenchFlags, summarizePaintSamples } from "./preview-bench.ts";
import { EXPORT_FPS, exportJumpVideo, seekVideo } from "./export.ts";
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
import { COMMUNITY_JUMPS_TITLE, mountCommunityJumps, refreshCommunityJumps } from "./community-list.ts";
import {
  appViewFromClick,
  canonicalAppUrl,
  documentTitleForView,
  parseAppView,
  pathForView,
  type AppView,
} from "./nav.ts";
import { reactionEmbedHtml, remountReactionEmbed, whenEmbedHostVisible } from "./reactions.ts";
import { exportFileName } from "./modes.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { PREVIEW_FPS, startVideoPaintLoop } from "./playback.ts";
import {
  muteButtonHtml,
  playPauseButtonHtml,
  PREVIEW_MUTED_DEFAULT,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
} from "./preview.ts";
import { downloadBlob } from "./recorder.ts";
import { reportError } from "./sentry.ts";
import { copyTextToClipboard, SHARE_TEXT, shareAppUrl } from "./share.ts";
import type { CutTimeline } from "./timeline.ts";

type StatusKind = "idle" | "busy" | "error";

function checkedNamedValue(inputs: readonly HTMLInputElement[], name: string): string | undefined {
  return inputs.find((input) => input.name === name && input.checked)?.value;
}

export async function boot(root: HTMLElement): Promise<void> {
  const timelinesPromise = loadTimelines();
  let timelines: Record<AspectMode, CutTimeline> | null = null;
  const ensureTimelines = async () => {
    timelines ??= await timelinesPromise;
    return timelines;
  };

  const benchFlags = readPreviewBenchFlags(typeof location === "undefined" ? "" : location.search);
  const compositor = createCompositor({
    resolutionScale: PREVIEW_RESOLUTION_SCALE,
    createKeyer: benchFlags.forceCpuKeying ? () => null : undefined,
  });
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
  let aspectResume: { play: boolean; time: number; tracked: boolean } | null = null;

  const stage = must(root, "#stage");
  const thumbs = must(root, "#thumbs");
  const slotMeter = must(root, "#slotMeter");
  const statusEl = must(root, "#status");
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
  const benchFlag = document.createElement("p");
  benchFlag.id = "benchFlag";
  benchFlag.hidden = !benchFlags.bench;
  benchFlag.style.cssText = "margin:0.4rem 0 0;font-size:0.78rem;color:#5c5146";
  previewState.after(benchFlag);
  const aspectInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="aspect"], input[name="preview-aspect"]'),
  ];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"], input[name="preview-swap"]')];
  const filterInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="filter"], input[name="preview-filter"]'),
  ];

  const aspectValue = checkedNamedValue(aspectInputs, "aspect");
  const swapValue = checkedNamedValue(swapInputs, "swap");
  const filterValue = checkedNamedValue(filterInputs, "filter");
  let mode: AspectMode = aspectValue && isAspectMode(aspectValue) ? aspectValue : DEFAULT_ASPECT;
  let swapStyle: SwapStyle = swapValue && isSwapStyle(swapValue) ? swapValue : "jump";
  let imageFilter: ImageFilter = filterValue && isImageFilter(filterValue) ? filterValue : "none";
  const video = createTemplateVideo(mode);
  stage.dataset.aspect = mode;
  if (mode !== DEFAULT_ASPECT) compositor.setAspect(mode);

  stage.prepend(compositor.canvas);
  compositor.canvas.setAttribute("aria-hidden", "true");
  compositor.canvas.removeAttribute("aria-label");
  document.body.append(video);

  const timeline = () => {
    if (!timelines) throw new Error("カット表がまだありません");
    return timelines[mode];
  };

  const refreshSlotMeter = () => {
    slotMeter.textContent = timelines
      ? `スロット — / ${timelines[mode].slots.length}`
      : "スロット — / —";
  };
  refreshSlotMeter();

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const setErrorStatus = (error: unknown, fallback: string) => {
    reportError(error);
    setStatus(error instanceof Error ? error.message : fallback, "error");
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
    modalPlayBtn.innerHTML = playPauseButtonHtml(active);
    modalPlayBtn.setAttribute("aria-pressed", active ? "true" : "false");
    stage.setAttribute("aria-pressed", active ? "true" : "false");
    previewState.textContent = active ? "再生中" : "停止中";
    for (const input of aspectInputs) {
      input.disabled = recording;
    }
    for (const input of swapInputs) {
      input.disabled = recording;
    }
    for (const input of filterInputs) {
      input.disabled = recording;
    }
  };

  const paintSamples: number[] = [];
  let paintClockStart = 0;

  const paint = (time?: number, character?: CharacterFrame) => {
    if (!timelines) return;
    const started = benchFlags.bench ? performance.now() : 0;
    const cuts = timeline();
    const slot = compositor.draw(video, photos, cuts, time, swapStyle, imageFilter, character);
    if (benchFlags.bench) {
      if (paintClockStart === 0) paintClockStart = started;
      paintSamples.push(performance.now() - started);
    }
    if (slot !== lastSlot) {
      lastSlot = slot;
      slotMeter.textContent = `スロット ${slot + 1} / ${cuts.slots.length}`;
    }
    refreshBenchFlag();
  };

  const benchSnapshot = () => {
    const elapsed = paintClockStart === 0 ? 0 : performance.now() - paintClockStart;
    const paints = summarizePaintSamples(paintSamples, elapsed, PREVIEW_FPS);
    const debug = compositor.keyingDebug();
    return {
      keying: compositor.keying,
      forcedCpu: benchFlags.forceCpuKeying,
      resolutionScale: compositor.resolutionScale(),
      aspect: mode,
      ...debug,
      paints,
    };
  };

  const refreshBenchFlag = () => {
    if (!benchFlags.bench) return;
    const snap = benchSnapshot();
    const renderer = snap.renderer ? ` / ${snap.renderer}` : "";
    const soft = snap.software ? " software" : "";
    benchFlag.textContent = `bench keying=${snap.keying}${soft}${renderer} scale=${snap.resolutionScale} n=${snap.paints.n}`;
  };

  if (benchFlags.bench && typeof window !== "undefined") {
    Object.assign(window, {
      __anoneBench: {
        snapshot: benchSnapshot,
        reset() {
          paintSamples.length = 0;
          paintClockStart = 0;
        },
      },
    });
  }

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
    muteBtn.innerHTML = muteButtonHtml(previewMuted);
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
      await ensureTimelines();
      if (gen !== playGen) return;
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
      setErrorStatus(error, "再生できませんでした");
    } finally {
      if (gen === playGen) playbackBusy = false;
    }
  };

  const openPreview = async () => {
    if (recording || !canUse() || previewDialog.open) return;
    try {
      previewDialog.showModal();
      await ensureTimelines();
      if (!previewDialog.open || recording) return;
      lastSlot = -1;
      paint();
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

  let communityMounted = false;
  let activeView: AppView | null = null;
  let embedPaintGen = 0;
  const applyView = (view: AppView) => {
    const makerView = must(root, "#makerView");
    const communityView = must(root, "#communityView");
    makerView.hidden = view !== "maker";
    communityView.hidden = view !== "community";
    document.title = documentTitleForView(view, COMMUNITY_JUMPS_TITLE);
    if (view !== "maker") {
      closePreview();
    }
    if (activeView !== view) {
      const firstPaint = activeView === null;
      activeView = view;
      window.scrollTo(0, 0);
      if (!firstPaint) {
        const heading =
          view === "community"
            ? root.querySelector<HTMLElement>("#communityJumpsTitle")
            : root.querySelector<HTMLElement>("#makerTitle");
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({
          preventScroll: true,
          focusVisible: false,
        } as FocusOptions & { focusVisible?: boolean });
      }
    }
    const paintGen = ++embedPaintGen;
    const host = view === "community" ? communityView : makerView;
    whenEmbedHostVisible(host, () => {
      if (paintGen !== embedPaintGen) return;
      if (view === "community") {
        const section = must(root, "#communityJumps");
        if (!communityMounted) {
          mountCommunityJumps(section);
          communityMounted = true;
        } else {
          refreshCommunityJumps(section);
        }
        return;
      }
      remountReactionEmbed(must(root, "#reactionsEmbed"), reactionEmbedHtml());
    });
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
    refreshSlotMeter();
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

  const applyFilter = (next: ImageFilter) => {
    if (next === imageFilter) return;
    imageFilter = next;
    syncFilterRadios(imageFilter);
    paint();
  };

  video.addEventListener("loadeddata", () => {
    void (async () => {
      await ensureTimelines();
      paint();
      refreshButtons();
      if (!recording) {
        setStatus(`テンプレ準備完了（${timeline().slots.length} カット）`);
      }
      const resume = aspectResume;
      aspectResume = null;
      if (!resume || !previewDialog.open || recording) return;
      previewTracked = resume.tracked;
      try {
        await seekVideo(video, resume.time);
        lastSlot = -1;
        paint();
        if (resume.play) {
          await startPlayback(false);
        } else {
          refreshButtons();
        }
      } catch (error) {
        paint();
        refreshButtons();
        setErrorStatus(error, "プレビューの再開に失敗しました");
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
  video.addEventListener("error", () => {
    if (recording) return;
    const code = video.error?.code;
    setErrorStatus(
      new Error(code != null ? `テンプレ動画を読み込めませんでした (${code})` : "テンプレ動画を読み込めませんでした"),
      "テンプレ動画を読み込めませんでした",
    );
    refreshButtons();
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

  for (const input of filterInputs) {
    input.addEventListener("change", () => {
      if (recording || !input.checked || !isImageFilter(input.value)) return;
      applyFilter(input.value);
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
      await ensureTimelines();
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
      setErrorStatus(error, "読み込みに失敗しました");
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
    compositor.setResolutionScale(1);
    try {
      const cuts = (await ensureTimelines())[mode];
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
      const filename = exportFileName(mode, swapStyle, result.extension, imageFilter);
      downloadBlob(result.blob, filename);
      setStatus(`保存しました（${result.extension.toUpperCase()}・生成）。ハッシュタグをコピーして X に投稿できます。`);
      trackEvent(VIDEO_SAVE_EVENT, analyticsParams());
    } catch (error) {
      setErrorStatus(error, "保存に失敗しました");
    } finally {
      compositor.setResolutionScale(PREVIEW_RESOLUTION_SCALE);
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

  void video.load();

  const goToView = (view: AppView) => {
    const next = `${pathForView(view)}${location.search}`;
    if (`${location.pathname}${location.search}` !== next) {
      history.pushState({ view }, "", next);
    }
    applyView(view);
  };

  const syncViewFromLocation = () => {
    const next = canonicalAppUrl(location);
    if (next) history.replaceState(history.state, "", next);
    applyView(parseAppView(location));
  };

  root.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;
    const view = appViewFromClick(anchor, location.origin);
    if (!view) return;
    event.preventDefault();
    goToView(view);
  });

  window.addEventListener("popstate", () => {
    applyView(parseAppView(location));
  });
  window.addEventListener("hashchange", syncViewFromLocation);
  syncViewFromLocation();
  await ensureTimelines();
  refreshSlotMeter();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    paint();
    refreshButtons();
  }
  root.dataset.appReady = "1";
}

export async function loadTimelines(): Promise<Record<AspectMode, CutTimeline>> {
  const [portrait, landscape] = await Promise.all([
    loadTimeline(TEMPLATES.portrait.cuts),
    loadTimeline(TEMPLATES.landscape.cuts),
  ]);
  return { portrait, landscape };
}

export async function loadTimeline(url: string): Promise<CutTimeline> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("カット表を読み込めませんでした");
  }
  return (await response.json()) as CutTimeline;
}

/** iOS Safari は playsinline が無いとフルスクリーンに逃げる。 */
export function createTemplateVideo(mode: AspectMode): HTMLVideoElement {
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

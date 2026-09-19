import { trackEvent, VIDEO_PREVIEW_EVENT, VIDEO_SAVE_EVENT, videoEventParams } from "./analytics.ts";
import { PREVIEW_RESOLUTION_SCALE } from "./canvas-size.ts";
import { createCompositor, type CharacterFrame } from "./compositor.ts";
import { readPreviewBenchFlags, summarizePaintSamples } from "./preview-bench.ts";
import { EXPORT_FPS, exportJumpVideo, exportProgressPercent, isAbortError, seekVideo, throwIfAborted } from "./export.ts";
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
import { persistLocale, syncLanguageNav } from "./i18n-client.ts";
import { mountCommunityJumps, refreshCommunityJumps } from "./community-list.ts";
import {
  DEFAULT_LOCALE,
  localeFromLanguageTags,
  localeRedirectLocation,
  messageFromError,
  parseAppPath,
  pathForApp,
  t,
  type Locale,
} from "./i18n.ts";
import {
  appPathFromClick,
  canonicalAppUrl,
  documentTitleForView,
  parseAppLocation,
  parseAppView,
  type AppView,
} from "./nav.ts";
import { pageUrl } from "./page-meta.ts";
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

export type BootOptions = {
  locale?: Locale;
};

export async function boot(root: HTMLElement, options: BootOptions = {}): Promise<void> {
  const cookie = typeof document === "undefined" ? "" : document.cookie;
  const languages =
    typeof navigator === "undefined"
      ? []
      : navigator.languages.length > 0
        ? [...navigator.languages]
        : [navigator.language];
  const dest = localeRedirectLocation(
    location.pathname,
    location.search,
    cookie,
    languages.join(","),
    typeof navigator === "undefined" ? "" : navigator.userAgent,
  );
  if (dest) {
    location.replace(dest);
    return;
  }

  const locale =
    options.locale ?? parseAppPath(location.pathname)?.locale ?? localeFromLanguageTags(languages) ?? DEFAULT_LOCALE;
  const msg = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t(locale, key, vars);

  const timelinesPromise = loadTimelines();
  let timelines: Record<AspectMode, CutTimeline> | null = null;
  const ensureTimelines = async () => {
    timelines ??= await timelinesPromise;
    return timelines;
  };

  const benchFlags = readPreviewBenchFlags(typeof location === "undefined" ? "" : location.search);
  const compositor = createCompositor({
    locale,
    resolutionScale: PREVIEW_RESOLUTION_SCALE,
    createKeyer: benchFlags.forceCpuKeying ? () => null : undefined,
  });
  let photos: LoadedPhoto[] = [];
  let playing = false;
  let recording = false;
  let exportAbort: AbortController | null = null;
  let pendingExport: { blob: Blob; filename: string } | null = null;
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
  const exportDialog = must(root, "#exportDialog") as HTMLDialogElement;
  const exportTitle = must(root, "#exportTitle");
  const exportStatus = must(root, "#exportStatus");
  const exportProgress = must(root, "#exportProgress") as HTMLProgressElement;
  const exportProgressLabel = must(root, "#exportProgressLabel");
  const exportKeepOpen = must(root, "#exportKeepOpen");
  const exportDownloadHint = must(root, "#exportDownloadHint");
  const cancelExportBtn = must(root, "#cancelExportBtn") as HTMLButtonElement;
  const downloadExportBtn = must(root, "#downloadExportBtn") as HTMLButtonElement;
  const closeExportBtn = must(root, "#closeExportBtn") as HTMLButtonElement;
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
    if (!timelines) throw new Error(msg("statusCutsMissing"));
    return timelines[mode];
  };

  const refreshSlotMeter = () => {
    slotMeter.textContent = timelines
      ? msg("previewSlotEmpty", { total: timelines[mode].slots.length })
      : msg("previewSlotPending");
  };
  refreshSlotMeter();

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    statusEl.textContent = text;
    statusEl.dataset.kind = kind;
  };

  const setErrorStatus = (error: unknown, fallback: Parameters<typeof t>[1]) => {
    reportError(error);
    setStatus(messageFromError(locale, error, fallback), "error");
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
        img.alt = photo.name || msg("makerPhotoAlt", { n: index + 1 });
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
    modalPlayBtn.innerHTML = playPauseButtonHtml(active, locale);
    modalPlayBtn.setAttribute("aria-pressed", active ? "true" : "false");
    stage.setAttribute("aria-pressed", active ? "true" : "false");
    previewState.textContent = active ? msg("previewPlaying") : msg("previewStopped");
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
      slotMeter.textContent = msg("previewSlot", { n: slot + 1, total: cuts.slots.length });
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
    muteBtn.innerHTML = muteButtonHtml(previewMuted, locale);
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
    setStatus(msg("statusPaused"));
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
      setStatus(msg("statusPreviewing"));
      await startLoop();
      if (gen !== playGen) return;
      await video.play();
      if (gen !== playGen) return;
      video.blur();
      modalPlayBtn.focus();
    } catch (error) {
      if (gen !== playGen) return;
      playing = false;
      previewTracked = false;
      haltLoop();
      refreshButtons();
      setErrorStatus(error, "statusPlayFailed");
    } finally {
      if (gen === playGen) playbackBusy = false;
    }
  };

  const closePreview = () => {
    if (previewDialog.open) {
      previewDialog.close();
    }
  };

  const setExportProgress = (percent: number, statusText: string) => {
    const value = Math.min(100, Math.max(0, percent));
    exportProgress.value = value;
    exportProgressLabel.textContent = msg("exportPercent", { percent: value });
    exportStatus.textContent = statusText;
    setStatus(statusText, "busy");
  };

  const setExportPhase = (phase: "busy" | "done") => {
    exportDialog.dataset.exportPhase = phase;
    exportTitle.textContent = phase === "done" ? msg("exportDoneTitle") : msg("exportTitle");
    exportKeepOpen.hidden = phase !== "busy";
    exportDownloadHint.hidden = phase !== "done";
    cancelExportBtn.hidden = phase !== "busy";
    downloadExportBtn.hidden = phase !== "done";
    closeExportBtn.hidden = phase !== "done";
    exportDialog.setAttribute("aria-describedby", phase === "done" ? "exportDownloadHint" : "exportKeepOpen");
  };

  const openExportDialog = () => {
    pendingExport = null;
    cancelExportBtn.disabled = false;
    setExportPhase("busy");
    setExportProgress(0, msg("statusExportPreparing"));
    if (!exportDialog.open) {
      exportDialog.showModal();
    }
  };

  const closeExportDialog = () => {
    pendingExport = null;
    if (exportDialog.open) {
      exportDialog.close();
    }
  };

  const cancelExport = () => {
    if (!exportAbort) return;
    exportAbort.abort();
    cancelExportBtn.disabled = true;
  };

  const savePendingExport = () => {
    if (!pendingExport) return;
    downloadBlob(pendingExport.blob, pendingExport.filename);
  };

  let openingPreview = false;
  const openPreview = async () => {
    if (recording || !canUse() || previewDialog.open || openingPreview) return;
    openingPreview = true;
    try {
      await ensureTimelines();
      if (recording || previewDialog.open) return;
      previewDialog.showModal();
      lastSlot = -1;
      paint();
    } catch (error) {
      closePreview();
      setErrorStatus(error, "statusPreviewOpenFailed");
      return;
    } finally {
      openingPreview = false;
    }
    await startPlayback(true);
  };

  let communityMounted = false;
  let activeView: AppView | null = null;
  let embedPaintGen = 0;
  const applyView = (view: AppView) => {
    const makerView = must(root, "#makerView");
    const communityView = must(root, "#communityView");
    makerView.hidden = view !== "maker";
    communityView.hidden = view !== "community";
    document.title = documentTitleForView(view, locale);
    syncLanguageNav(root, locale, view);
    if (view !== "maker") {
      closePreview();
      cancelExport();
      closeExportDialog();
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
      if (!recording && photos.length === 0) {
        setStatus(msg("statusTemplateReady", { n: timeline().slots.length }));
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
        setErrorStatus(error, "statusPreviewResumeFailed");
      }
    })();
  });
  video.addEventListener("ended", () => {
    if (!recording) {
      stopPlayback();
      paint();
      setStatus(msg("statusPreviewEnded"));
    }
  });
  video.addEventListener("error", () => {
    if (recording) return;
    const code = video.error?.code;
    setErrorStatus(
      new Error(code != null ? msg("statusTemplateLoadFailedCode", { code }) : msg("statusTemplateLoadFailed")),
      "statusTemplateLoadFailed",
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
    setStatus(msg("statusPhotosLoading"), "busy");
    try {
      revokePhotos(photos);
      photos = [];
      renderThumbs();
      photos = await loadPhotos(files, {
        onProgress: (current, total) => {
          setStatus(msg("statusPhotosLoadingProgress", { current, total }), "busy");
        },
      });
      renderThumbs();
      await ensureTimelines();
      paint();
      refreshButtons();
      setStatus(
        photos.length === 0
          ? msg("statusPickImages")
          : msg("statusPhotosLoaded", { n: photos.length }),
      );
    } catch (error) {
      renderThumbs();
      paint();
      refreshButtons();
      setErrorStatus(error, "statusLoadFailed");
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

  cancelExportBtn.addEventListener("click", () => {
    cancelExport();
  });

  downloadExportBtn.addEventListener("click", () => {
    savePendingExport();
  });

  closeExportBtn.addEventListener("click", () => {
    closeExportDialog();
  });

  exportDialog.addEventListener("cancel", (event) => {
    if (exportAbort) {
      cancelExport();
      return;
    }
    if (pendingExport) return;
    event.preventDefault();
  });

  exportDialog.addEventListener("close", () => {
    pendingExport = null;
  });

  window.addEventListener("beforeunload", (event) => {
    if (!recording) return;
    event.preventDefault();
    event.returnValue = "";
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
    const controller = new AbortController();
    exportAbort = controller;
    openExportDialog();
    try {
      const cuts = (await ensureTimelines())[mode];
      throwIfAborted(controller.signal);
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : cuts.duration;
      const fps = cuts.fps && cuts.fps > 0 ? cuts.fps : EXPORT_FPS;
      compositor.setResolutionScale(1);
      const result = await exportJumpVideo({
        video,
        canvas: compositor.canvas,
        draw: paint,
        duration,
        fps,
        signal: controller.signal,
        onProgress: (progress) => {
          setExportProgress(
            exportProgressPercent(progress.current, progress.total),
            msg("statusGenerating", { current: progress.current, total: progress.total }),
          );
        },
      });
      const filename = exportFileName(mode, swapStyle, result.extension, imageFilter);
      pendingExport = { blob: result.blob, filename };
      downloadBlob(result.blob, filename);
      setExportProgress(100, msg("statusSaved", { ext: result.extension.toUpperCase() }));
      setStatus(msg("statusSaved", { ext: result.extension.toUpperCase() }));
      setExportPhase("done");
      downloadExportBtn.focus();
      trackEvent(VIDEO_SAVE_EVENT, analyticsParams());
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        setStatus(msg("statusExportCancelled"));
      } else {
        setErrorStatus(error, "statusSaveFailed");
      }
    } finally {
      exportAbort = null;
      compositor.setResolutionScale(PREVIEW_RESOLUTION_SCALE);
      recording = false;
      playing = false;
      previewTracked = false;
      haltLoop();
      video.pause();
      video.muted = true;
      if (!pendingExport) closeExportDialog();
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
      setStatus(msg("statusHashtagsCopied"));
    } else {
      setStatus(msg("statusCopyUnsupported", { text: SHARE_TEXT }), "error");
    }
  });

  shareAppBtn.addEventListener("click", async () => {
    const shareUrl = pageUrl(locale, "maker");
    const outcome = await shareAppUrl({
      navigator: typeof navigator === "undefined" ? undefined : navigator,
      copyText: (text) =>
        copyTextToClipboard(
          text,
          typeof navigator === "undefined" ? undefined : navigator.clipboard,
        ),
      url: shareUrl,
    });
    if (outcome === "shared") {
      setStatus(msg("statusShared"));
    } else if (outcome === "copied") {
      setStatus(msg("statusUrlCopied"));
    } else if (outcome === "cancelled") {
      setStatus(msg("statusShareCancelled"));
    } else {
      setStatus(msg("statusShareUnsupported", { url: shareUrl }), "error");
    }
  });

  void video.load();

  const goToView = (view: AppView) => {
    const next = `${pathForApp(locale, view)}${location.search}`;
    if (`${location.pathname}${location.search}` !== next) {
      history.pushState({ view, locale }, "", next);
    }
    applyView(view);
  };

  const syncViewFromLocation = () => {
    const next = canonicalAppUrl(location);
    if (next) history.replaceState(history.state, "", next);
    applyView(parseAppLocation(location).view);
  };

  root.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent) || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    if (!anchor) return;
    const clicked = appPathFromClick(anchor, location.origin);
    if (!clicked) return;
    if (clicked.locale !== locale) {
      persistLocale(clicked.locale);
      return;
    }
    event.preventDefault();
    goToView(clicked.view);
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
    throw new Error(t(DEFAULT_LOCALE, "statusCutsFailed"));
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

import { trackEvent, VIDEO_PREVIEW_EVENT, VIDEO_SAVE_EVENT, videoEventParams } from "./analytics.ts";
import { PREVIEW_RESOLUTION_SCALE } from "./canvas-size.ts";
import type { CharacterFrame, Compositor } from "./compositor.ts";
import { readPreviewBenchFlags, summarizePaintSamples } from "./preview-bench.ts";
import { EXPORT_FPS, exportJumpVideo, exportProgressPercent, isAbortError, seekVideo, throwIfAborted } from "./export.ts";
import {
  DEFAULT_ASPECT,
  DEFAULT_CHARACTER_SIZE,
  isAspectMode,
  isCharacterSize,
  isImageFilter,
  isSwapStyle,
  TEMPLATES,
  type AspectMode,
  type CharacterSize,
  type ImageFilter,
  type SwapStyle,
} from "./layout.ts";
import {
  DEFAULT_LOCALE,
  localeFromLanguageTags,
  localeRedirectLocation,
  messageFromError,
  parseAppPath,
  t,
  type Locale,
} from "./i18n.ts";
import { exportFileName } from "./modes.ts";
import { appendAll, orderByIds, PHOTO_MAX_COUNT, removeById, sameIdOrder, takeUpToPhotoCap } from "./photo-list.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { ensureSeekableTemplate } from "./seekable-template.ts";
import { setEditorState, setEditorHandlers } from "./editor-store.ts";
import { setPhotoThumbsHandlers, setPhotoThumbsState } from "./photo-thumbs-store.ts";
import { PREVIEW_FPS, startVideoPaintLoop } from "./playback.ts";
import {
  PREVIEW_MUTED_DEFAULT,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
  syncMuteControl,
} from "./preview.ts";
import { downloadBlob } from "./recorder.ts";
import { reportError } from "./sentry.ts";
import { copyTextToClipboard, SHARE_TEXT, shareHashtags } from "./share.ts";
import { isolateVolatileChrome, setTextIfChanged } from "./translate-guard.ts";
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
  let compositor: Compositor | null = null;
  let compositorPromise: Promise<Compositor> | null = null;
  let photos: LoadedPhoto[] = [];
  let photosBusy = false;
  let playing = false;
  let recording = false;
  let seeking = false;
  let exportAbort: AbortController | null = null;
  let pendingExport: { blob: Blob; filename: string } | null = null;
  let previewTracked = false;
  let previewMuted = PREVIEW_MUTED_DEFAULT;
  let playbackBusy = false;
  let playGen = 0;
  let suppressPlayUntil = 0;
  let stopLoop: (() => void) | null = null;
  let aspectResume: { play: boolean; time: number; tracked: boolean } | null = null;

  const stage = must(root, "#stage") as HTMLButtonElement;
  const pickerLabel = must(root, "#pickerLabel");
  const statusEl = must(root, "#status");
  const playBtn = must(root, "#playBtn") as HTMLButtonElement;
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const copyHashtagsBtn = must(root, "#copyHashtagsBtn") as HTMLButtonElement;
  const shareAppBtn = must(root, "#shareAppBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const previewRegion = must(root, "#previewRegion");
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
  const restartBtn = must(root, "#restartBtn") as HTMLButtonElement;
  const muteBtn = must(root, "#muteBtn") as HTMLButtonElement;
  const benchFlag = document.createElement("p");
  benchFlag.id = "benchFlag";
  benchFlag.hidden = !benchFlags.bench;
  benchFlag.style.cssText = "margin:0.4rem 0 0;font-size:0.78rem;color:#5c5146";
  muteBtn.closest(".preview-actions")?.after(benchFlag);
  const aspectInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="aspect"], input[name="preview-aspect"]'),
  ];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"], input[name="preview-swap"]')];
  const filterInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="filter"], input[name="preview-filter"]'),
  ];
  const characterInputs = [
    ...root.querySelectorAll<HTMLInputElement>('input[name="character"], input[name="preview-character"]'),
  ];

  const aspectValue = checkedNamedValue(aspectInputs, "aspect");
  const swapValue = checkedNamedValue(swapInputs, "swap");
  const filterValue = checkedNamedValue(filterInputs, "filter");
  const characterValue = checkedNamedValue(characterInputs, "character");
  let mode: AspectMode = aspectValue && isAspectMode(aspectValue) ? aspectValue : DEFAULT_ASPECT;
  let swapStyle: SwapStyle = swapValue && isSwapStyle(swapValue) ? swapValue : "jump";
  let imageFilter: ImageFilter = filterValue && isImageFilter(filterValue) ? filterValue : "none";
  let characterSize: CharacterSize =
    characterValue && isCharacterSize(characterValue) ? characterValue : DEFAULT_CHARACTER_SIZE;
  const video = createTemplateVideo(mode);
  stage.dataset.aspect = mode;
  document.body.append(video);

  const attachCompositorCanvas = (created: Compositor) => {
    if (created.canvas.isConnected) return;
    stage.prepend(created.canvas);
    created.canvas.setAttribute("aria-hidden", "true");
    created.canvas.removeAttribute("aria-label");
  };

  const ensureCompositor = (): Promise<Compositor> => {
    compositorPromise ??= import("./compositor.ts")
      .then(({ createCompositor }) => {
        const created = createCompositor({
          locale,
          resolutionScale: PREVIEW_RESOLUTION_SCALE,
          createKeyer: benchFlags.forceCpuKeying ? () => null : undefined,
        });
        if (mode !== DEFAULT_ASPECT) created.setAspect(mode);
        attachCompositorCanvas(created);
        compositor = created;
        return created;
      })
      .catch((error: unknown) => {
        compositorPromise = null;
        throw error;
      });
    return compositorPromise;
  };

  isolateVolatileChrome(statusEl);
  isolateVolatileChrome(benchFlag);
  isolateVolatileChrome(exportStatus);
  isolateVolatileChrome(exportProgressLabel);

  const timeline = () => {
    if (!timelines) throw new Error(msg("statusCutsMissing"));
    return timelines[mode];
  };

  const setStatus = (text: string, kind: StatusKind = "idle") => {
    setTextIfChanged(statusEl, text);
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

  const syncCharacterRadios = (value: CharacterSize) => {
    for (const input of characterInputs) {
      input.checked = input.value === value;
    }
  };

  const photosLocked = () => recording || photosBusy || seeking;

  const syncPickerLabel = () => {
    if (photos.length === 0) {
      pickerLabel.textContent = msg("makerPickPhotos");
      return;
    }
    pickerLabel.textContent =
      photos.length >= PHOTO_MAX_COUNT
        ? msg("makerPhotosFull", { n: PHOTO_MAX_COUNT })
        : msg("makerAddPhotos");
  };

  const renderThumbs = () => {
    setPhotoThumbsState({
      photos: photos.map((photo) => ({ id: photo.id, name: photo.name, thumbUrl: photo.thumbUrl })),
      locked: photosLocked(),
    });
    syncPickerLabel();
  };

  const canUse = () => photos.length > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const isPreviewPlaying = () => playing || (!video.paused && !video.ended);

  const refreshButtons = () => {
    const ready = canUse() && !seeking;
    const locked = photosLocked();
    playBtn.disabled = recording || !ready;
    const saveDisabled = recording || !ready;
    saveBtn.disabled = saveDisabled;
    setEditorState({ ready, locked, playing: isPreviewPlaying() });
    stage.disabled = recording || !ready;
    restartBtn.disabled = recording || !ready;
    muteBtn.disabled = recording;
    picker.disabled = locked || photos.length >= PHOTO_MAX_COUNT;
    renderThumbs();
    const active = isPreviewPlaying();
    stage.setAttribute("aria-pressed", active ? "true" : "false");
    for (const input of aspectInputs) {
      input.disabled = recording || seeking;
    }
    for (const input of swapInputs) {
      input.disabled = recording || seeking;
    }
    for (const input of filterInputs) {
      input.disabled = recording || seeking;
    }
    for (const input of characterInputs) {
      input.disabled = recording || seeking;
    }
  };

  const paintSamples: number[] = [];
  let paintClockStart = 0;

  const paint = (time?: number, character?: CharacterFrame) => {
    if (!compositor || !timelines) return;
    const started = benchFlags.bench ? performance.now() : 0;
    const cuts = timeline();
    compositor.draw(video, photos, cuts, time, swapStyle, imageFilter, character, characterSize);
    if (benchFlags.bench) {
      if (paintClockStart === 0) paintClockStart = started;
      paintSamples.push(performance.now() - started);
    }
    refreshBenchFlag();
  };

  const applyPhotoOrder = (ids: readonly string[]) => {
    const next = orderByIds(photos, ids);
    if (sameIdOrder(photos, next)) return;
    photos = next;
    setEditorState({ exported: false });
    renderThumbs();
    paint();
  };

  const removePhoto = (id: string) => {
    if (photosLocked()) return;
    const { removed, rest } = removeById(photos, id);
    if (!removed) return;
    photos = rest;
    setEditorState({ exported: false });
    if (photos.length === 0) stopPlayback();
    revokePhotos([removed]);
    renderThumbs();
    paint();
    refreshButtons();
    if (photos.length === 0) {
      setStatus(msg("statusPhotosCleared"));
      return;
    }
    setStatus(msg("statusPhotoRemoved", { n: photos.length }));
  };

  setPhotoThumbsHandlers({
    onReorder: applyPhotoOrder,
    onRemove: removePhoto,
  });
  renderThumbs();

  const benchSnapshot = () => {
    const elapsed = paintClockStart === 0 ? 0 : performance.now() - paintClockStart;
    const paints = summarizePaintSamples(paintSamples, elapsed, PREVIEW_FPS);
    const debug = compositor?.keyingDebug() ?? {
      backend: "cpu" as const,
      context: "none" as const,
      renderer: "",
      vendor: "",
      software: false,
    };
    return {
      keying: compositor?.keying ?? "cpu",
      forcedCpu: benchFlags.forceCpuKeying,
      resolutionScale: compositor?.resolutionScale() ?? PREVIEW_RESOLUTION_SCALE,
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
    setTextIfChanged(
      benchFlag,
      `bench keying=${snap.keying}${soft}${renderer} scale=${snap.resolutionScale} n=${snap.paints.n}`,
    );
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
    syncMuteControl(muteBtn, previewMuted, locale);
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
    stopPlayback();
    video.muted = true;
  };

  const setExportProgress = (percent: number, statusText: string) => {
    const value = Math.min(100, Math.max(0, percent));
    exportProgress.value = value;
    setTextIfChanged(exportProgressLabel, msg("exportPercent", { percent: value }));
    setTextIfChanged(exportStatus, statusText);
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

  const applyAspect = (next: AspectMode) => {
    if (next === mode) return;
    const inPreview = canUse();
    aspectResume = inPreview
      ? { play: isPreviewPlaying(), time: video.currentTime, tracked: previewTracked }
      : null;
    playGen += 1;
    playbackBusy = false;
    playing = false;
    haltLoop();
    // Avoid starting WebKit resource selection on a video with no source yet.
    if (video.hasAttribute("src")) video.pause();
    if (!inPreview) {
      previewTracked = false;
    }
    mode = next;
    setEditorState({ exported: false });
    compositor?.setAspect(mode);
    stage.dataset.aspect = mode;
    syncAspectRadios(mode);
    video.dataset.templateSrc = TEMPLATES[mode].video;
    if (video.hasAttribute("src")) {
      video.removeAttribute("src");
      video.load();
    }
    video.preload = "none";
    if (photos.length > 0 || recording) {
      beginTemplateVideoLoad(video);
    }
    refreshButtons();
  };

  const applySwap = (next: SwapStyle) => {
    if (next === swapStyle) return;
    swapStyle = next;
    setEditorState({ exported: false });
    syncSwapRadios(swapStyle);
    paint();
  };

  const applyFilter = (next: ImageFilter) => {
    if (next === imageFilter) return;
    imageFilter = next;
    setEditorState({ exported: false });
    syncFilterRadios(imageFilter);
    paint();
  };

  const applyCharacterSize = (next: CharacterSize) => {
    if (next === characterSize) return;
    characterSize = next;
    setEditorState({ exported: false });
    syncCharacterRadios(characterSize);
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
      setEditorState({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
      const resume = aspectResume;
      aspectResume = null;
      if (!resume || recording) return;
      previewTracked = resume.tracked;
      try {
        await seekVideo(video, resume.time);
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

  for (const input of characterInputs) {
    input.addEventListener("change", () => {
      if (recording || !input.checked || !isCharacterSize(input.value)) return;
      applyCharacterSize(input.value);
    });
  }

  picker.addEventListener("change", async () => {
    const files = takeUpToPhotoCap(photos.length, [...(picker.files ?? [])]);
    picker.value = "";
    if (files.length === 0 || photosLocked()) return;
    beginTemplateVideoLoad(video);
    const hadPhotos = photos.length > 0;
    photosBusy = true;
    refreshButtons();
    setStatus(msg("statusPhotosLoading"), "busy");
    try {
      const compositorReady = ensureCompositor();
      const added = await loadPhotos(files, {
        onProgress: (current, total) => {
          setStatus(msg("statusPhotosLoadingProgress", { current, total }), "busy");
        },
      });
      photos = appendAll(photos, added);
      setEditorState({ exported: false });
      renderThumbs();
      await compositorReady;
      await ensureTimelines();
      paint();
      setStatus(
        photos.length === 0
          ? msg("statusPickImages")
          : hadPhotos
            ? msg("statusPhotosAdded", { n: added.length, total: photos.length })
            : msg("statusPhotosLoaded", { n: photos.length }),
      );
    } catch (error) {
      renderThumbs();
      paint();
      setErrorStatus(error, "statusLoadFailed");
    } finally {
      photosBusy = false;
      refreshButtons();
    }
  });

  playBtn.addEventListener("click", () => {
    togglePreviewPlay();
  });

  const togglePreviewPlay = () => {
    if (isPreviewPlaying() || playbackBusy) {
      pausePlayback();
      return;
    }
    void startPlayback(false);
  };

  previewRegion.addEventListener(
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

  const startSave = async () => {
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
      const comp = await ensureCompositor();
      throwIfAborted(controller.signal);
      comp.setResolutionScale(1);
      const result = await exportJumpVideo({
        video,
        canvas: comp.canvas,
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
      setEditorState({ exported: true });
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
      compositor?.setResolutionScale(PREVIEW_RESOLUTION_SCALE);
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
  };

  saveBtn.addEventListener("click", () => {
    void startSave();
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
    const outcome = await shareHashtags({
      navigator: typeof navigator === "undefined" ? undefined : navigator,
      copyText: (text) =>
        copyTextToClipboard(
          text,
          typeof navigator === "undefined" ? undefined : navigator.clipboard,
        ),
    });
    if (outcome === "shared") {
      setStatus(msg("statusShared"));
    } else if (outcome === "copied") {
      setStatus(msg("statusHashtagsCopied"));
    } else if (outcome === "cancelled") {
      setStatus(msg("statusShareCancelled"));
    } else {
      setStatus(msg("statusShareUnsupported", { text: SHARE_TEXT }), "error");
    }
  });

  setEditorHandlers({ pause: pausePlayback, seek: async (time) => {
    if (recording || seeking || !canUse()) return;
    seeking = true;
    pausePlayback();
    try {
      await ensureSeekableTemplate(video, time);
      await seekVideo(video, Math.max(0, Math.min(time, video.duration)));
      paint();
      setEditorState({ time: video.currentTime });
    } catch (error) {
      setErrorStatus(error, "statusPreviewResumeFailed");
    } finally {
      seeking = false;
      refreshButtons();
    }
  } });
  video.addEventListener("timeupdate", () => setEditorState({ time: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : 0 }));
  setEditorState({ booted: true });
  refreshButtons();
  root.dataset.controlsReady = "1";
  await ensureTimelines();
  if (benchFlags.bench) await ensureCompositor();
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
  video.dataset.templateSrc = TEMPLATES[mode].video;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "none";
  video.controls = false;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.tabIndex = -1;
  video.className = "offscreen-video";
  return video;
}

/** 写真選択やプレビューまでテンプレ本体を取りに行かない。 */
export function beginTemplateVideoLoad(video: HTMLVideoElement): void {
  const src = video.dataset.templateSrc;
  if (!src) return;
  const current = video.getAttribute("src");
  if (video.preload === "auto" && (current === src || (current?.startsWith("blob:") && video.dataset.loadedTemplate === src))) return;
  video.preload = "auto";
  video.dataset.loadedTemplate = src;
  video.src = src;
  video.load();
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

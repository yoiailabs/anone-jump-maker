import {
  GENERATE_CANCEL_EVENT,
  GENERATE_FAIL_EVENT,
  GENERATE_START_EVENT,
  MAKE_OPEN_EVENT,
  generateFailReason,
  PHOTO_PICKER_OPEN_EVENT,
  PHOTOS_REJECTED_EVENT,
  PHOTOS_SELECTED_EVENT,
  trackEvent,
  VIDEO_PREVIEW_EVENT,
  VIDEO_SAVE_EVENT,
  videoEventParams,
} from "./analytics.ts";
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
import { persistLocale, syncLanguageNav } from "./i18n-client.ts";
import { applyJaPhrasePolyfill } from "./ja-phrase.ts";
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
import { reactionEmbedHtml, remountReactionEmbed, whenEmbedHostVisible, whenNearViewport } from "./reactions.ts";
import { exportFileName } from "./modes.ts";
import { appendAll, orderByIds, PHOTO_MAX_COUNT, removeById, sameIdOrder, takeUpToPhotoCap } from "./photo-list.ts";
import { HEIC_UNSUPPORTED_MESSAGE, loadPhotos, revokePhotos, selectImageFiles, type LoadedPhoto } from "./photos.ts";
import { setPhotoThumbsHandlers, setPhotoThumbsState } from "./photo-thumbs-store.ts";
import { PREVIEW_FPS, startVideoPaintLoop } from "./playback.ts";
import {
  formatPreviewClock,
  PREVIEW_MUTED_DEFAULT,
  shouldLoopPreviewPlayback,
  shouldRevealPreviewChrome,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
  syncMuteControl,
} from "./preview.ts";
import { setPreviewChromeState } from "./preview-chrome-store.ts";
import { downloadBlob } from "./recorder.ts";
import { reportError } from "./sentry.ts";
import {
  canShareFiles,
  copyTextToClipboard,
  isXInAppBrowser,
  SHARE_TEXT,
  shareHashtags,
  shareVideoFile,
  videoFileForShare,
} from "./share.ts";
import { setFeedbackState, type FeedbackPlace } from "./feedback-store.ts";
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
  let chromeOpen = false;
  let chromeTimer = 0;
  let photosBusy = false;
  let playing = false;
  let recording = false;
  let exportAbort: AbortController | null = null;
  let pendingExport: { blob: Blob; filename: string; mime: string; extension: string } | null = null;
  let sharingExport = false;
  let previewTracked = false;
  let previewMuted = PREVIEW_MUTED_DEFAULT;
  let playbackBusy = false;
  let playGen = 0;
  let suppressPlayUntil = 0;
  let stopLoop: (() => void) | null = null;
  let aspectResume: { play: boolean; time: number; tracked: boolean } | null = null;

  const stage = must(root, "#stage");
  const previewTransport = must(root, "#previewTransport");
  const pickerLabel = must(root, "#pickerLabel");
  const photoFeedback = must(root, "#photoFeedback");
  const previewFeedback = must(root, "#previewFeedback");
  const saveFeedback = must(root, "#saveFeedback");
  const shareFeedback = must(root, "#shareFeedback");
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const copyHashtagsBtn = must(root, "#copyHashtagsBtn") as HTMLButtonElement;
  const shareAppBtn = must(root, "#shareAppBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const previewSeek = must(root, "#previewSeek") as HTMLInputElement;
  const previewTime = must(root, "#previewTime");
  const studioEmpty = must(root, "#studioEmpty") as HTMLButtonElement;
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
  const previewToggle = must(root, "#previewToggle") as HTMLButtonElement;
  const muteBtn = must(root, "#muteBtn") as HTMLButtonElement;
  const benchFlag = document.createElement("p");
  benchFlag.id = "benchFlag";
  benchFlag.hidden = !benchFlags.bench;
  benchFlag.style.cssText = "margin:0.4rem 0 0;font-size:0.78rem;color:#5c5146";
  stage.closest(".studio-stage")?.after(benchFlag);
  const aspectInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="aspect"]')];
  const swapInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="swap"]')];
  const filterInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="filter"]')];
  const characterInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="character"]')];

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

  isolateVolatileChrome(photoFeedback);
  isolateVolatileChrome(previewFeedback);
  isolateVolatileChrome(saveFeedback);
  isolateVolatileChrome(shareFeedback);
  isolateVolatileChrome(benchFlag);
  isolateVolatileChrome(exportStatus);
  isolateVolatileChrome(exportProgressLabel);

  const timeline = () => {
    if (!timelines) throw new Error(msg("statusCutsMissing"));
    return timelines[mode];
  };

  const setFeedback = (place: FeedbackPlace, text: string, kind: StatusKind = "idle") => {
    setFeedbackState(place, { text, kind });
  };

  const clearFeedback = (place: FeedbackPlace) => {
    setFeedback(place, "");
  };

  const setErrorFeedback = (place: FeedbackPlace, error: unknown, fallback: Parameters<typeof t>[1]) => {
    reportError(error);
    setFeedback(place, messageFromError(locale, error, fallback), "error");
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

  const photosLocked = () => recording || photosBusy;

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
    studioEmpty.hidden = photos.length > 0;
    studioEmpty.disabled = picker.disabled;
    syncPickerLabel();
    if (photos.length === 0) {
      chromeOpen = false;
      window.clearTimeout(chromeTimer);
      chromeTimer = 0;
      stage.removeAttribute("data-chrome");
    }
  };

  const canUse = () => photos.length > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

  const isPreviewPlaying = () => playing || (!video.paused && !video.ended);

  const armChromeTimer = () => {
    window.clearTimeout(chromeTimer);
    chromeTimer = 0;
    if (!chromeOpen || !isPreviewPlaying()) return;
    chromeTimer = window.setTimeout(() => {
      if (!chromeOpen || !isPreviewPlaying()) return;
      chromeOpen = false;
      stage.removeAttribute("data-chrome");
    }, 4000);
  };

  const setChromeOpen = (open: boolean) => {
    chromeOpen = open && photos.length > 0;
    if (chromeOpen) stage.setAttribute("data-chrome", "open");
    else stage.removeAttribute("data-chrome");
    armChromeTimer();
  };

  const refreshButtons = () => {
    const ready = canUse();
    const locked = photosLocked();
    const saveDisabled = recording || sharingExport || !ready;
    saveBtn.disabled = saveDisabled;
    muteBtn.disabled = recording;
    picker.disabled = locked || photos.length >= PHOTO_MAX_COUNT;
    renderThumbs();
    const active = isPreviewPlaying();
    stage.setAttribute("aria-pressed", active ? "true" : "false");
    setPreviewChromeState({ playing: active, enabled: ready && !recording });
    if (shouldRevealPreviewChrome({ ready, playing: active, recording })) setChromeOpen(true);
    for (const input of aspectInputs) {
      input.disabled = recording;
    }
    for (const input of swapInputs) {
      input.disabled = recording;
    }
    for (const input of filterInputs) {
      input.disabled = recording;
    }
    for (const input of characterInputs) {
      input.disabled = recording;
    }
    armChromeTimer();
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
    renderThumbs();
    paint();
  };

  const removePhoto = (id: string) => {
    if (photosLocked()) return;
    const { removed, rest } = removeById(photos, id);
    if (!removed) return;
    photos = rest;
    revokePhotos([removed]);
    renderThumbs();
    paint();
    refreshButtons();
    clearFeedback("photo");
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
      clearFeedback("preview");
      refreshButtons();
      await startLoop();
      if (gen !== playGen) return;
      await video.play();
      if (gen !== playGen) {
        video.pause();
        return;
      }
      video.blur();
    } catch (error) {
      if (gen !== playGen) return;
      playing = false;
      previewTracked = false;
      haltLoop();
      refreshButtons();
      setErrorFeedback("preview", error, "statusPlayFailed");
    } finally {
      if (gen === playGen) playbackBusy = false;
    }
  };

  const syncSeek = () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    previewSeek.max = String(duration > 0 ? duration : 1);
    previewSeek.disabled = recording || duration <= 0;
    const time = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    if (!seeking) {
      previewSeek.value = String(duration > 0 ? Math.min(duration, Math.max(0, time)) : 0);
    }
    const shown = seeking ? Number(previewSeek.value) : time;
    previewTime.textContent = formatPreviewClock(shown, duration);
  };

  let seeking = false;
  let seekGen = 0;
  const scrubTo = (time: number) => {
    if (recording || !Number.isFinite(time)) return;
    if (isPreviewPlaying() || playbackBusy) pausePlayback();
    const gen = ++seekGen;
    void seekVideo(video, time).then(() => {
      if (gen !== seekGen) return;
      paint();
      refreshButtons();
    });
  };

  const setExportProgress = (percent: number, statusText: string) => {
    const value = Math.min(100, Math.max(0, percent));
    exportProgress.value = value;
    setTextIfChanged(exportProgressLabel, msg("exportPercent", { percent: value }));
    setTextIfChanged(exportStatus, statusText);
  };

  const fileShareAvailable = () => {
    if (!pendingExport) return false;
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    return canShareFiles(nav, [videoFileForShare(pendingExport.blob, pendingExport.filename, pendingExport.mime)]);
  };

  const setExportPhase = (phase: "busy" | "done") => {
    exportDialog.dataset.exportPhase = phase;
    exportTitle.textContent = phase === "done" ? msg("exportDoneTitle") : msg("exportTitle");
    exportKeepOpen.hidden = phase !== "busy";
    exportDownloadHint.hidden = phase !== "done";
    if (phase === "done") {
      const shareReady = fileShareAvailable();
      const hintKey = !shareReady
        ? "exportDownloadHint"
        : isXInAppBrowser(typeof navigator === "undefined" ? "" : navigator.userAgent)
          ? "exportShareHintX"
          : "exportShareHint";
      setTextIfChanged(exportDownloadHint, msg(hintKey));
    }
    cancelExportBtn.hidden = phase !== "busy";
    downloadExportBtn.hidden = phase !== "done";
    downloadExportBtn.classList.remove("ghost");
    closeExportBtn.hidden = phase !== "done";
    exportDialog.setAttribute("aria-describedby", phase === "done" ? "exportDownloadHint" : "exportKeepOpen");
  };

  const openExportDialog = () => {
    clearFeedback("save");
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

  let exportSaveTracked = false;
  const trackExportSaved = () => {
    if (exportSaveTracked) return;
    exportSaveTracked = true;
    trackEvent(VIDEO_SAVE_EVENT, analyticsParams());
  };

  const savedStatus = (extension: string) => msg("statusSaved", { ext: extension.toUpperCase() });

  const markExportSaved = (extension: string) => {
    const text = savedStatus(extension);
    setExportProgress(100, text);
  };

  const showExportReady = () => {
    const text = msg("statusExportReadyDownload");
    setExportProgress(100, text);
    setExportPhase("done");
  };

  const downloadPendingExport = (pending: NonNullable<typeof pendingExport>) => {
    downloadBlob(pending.blob, pending.filename);
    markExportSaved(pending.extension);
    trackExportSaved();
  };

  const savePendingExport = async () => {
    if (!pendingExport || sharingExport) return;
    const pending = pendingExport;
    if (!fileShareAvailable()) {
      downloadPendingExport(pending);
      return;
    }
    sharingExport = true;
    refreshButtons();
    downloadExportBtn.disabled = true;
    try {
      setExportProgress(100, msg("statusExportSharing"));
      const outcome = await shareVideoFile({
        blob: pending.blob,
        filename: pending.filename,
        mime: pending.mime,
        navigator: typeof navigator === "undefined" ? undefined : navigator,
      });
      if (outcome === "cancelled") {
        if (pendingExport === pending) {
          const text = msg("statusExportShareCancelled");
          setExportProgress(100, text);
        }
        return;
      }
      if (outcome === "shared") {
        if (pendingExport === pending) markExportSaved(pending.extension);
        else setFeedback("save", savedStatus(pending.extension));
        trackExportSaved();
        return;
      }
      if (pendingExport !== pending) return;
      downloadPendingExport(pending);
    } finally {
      sharingExport = false;
      downloadExportBtn.disabled = false;
      if (pendingExport === pending) setExportPhase("done");
      refreshButtons();
    }
  };

  const armStudio = () => {
    beginTemplateVideoLoad(video);
    void ensureCompositor()
      .then(() => {
        paint();
        syncSeek();
      })
      .catch((error: unknown) => {
        setErrorFeedback("preview", error, "statusPreviewOpenFailed");
      });
  };

  let communityMounted = false;
  let makerReactionsArmed = false;
  let activeView: AppView | null = null;
  let embedPaintGen = 0;
  const focusViewHeading = (view: AppView) => {
    const heading =
      view === "community"
        ? root.querySelector<HTMLElement>("#communityJumpsTitle")
        : view === "studio"
          ? root.querySelector<HTMLElement>("#studioTitle")
          : root.querySelector<HTMLElement>("#makerTitle");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({
      preventScroll: true,
      focusVisible: false,
    } as FocusOptions & { focusVisible?: boolean });
  };
  const applyView = async (view: AppView) => {
    if (view === "privacy" || view === "terms") {
      const next = `${pathForApp(locale, view)}${location.search}`;
      if (`${location.pathname}${location.search}` !== next) location.assign(next);
      return;
    }
    const makerView = must(root, "#makerView");
    const studioView = must(root, "#studioView");
    const communityView = must(root, "#communityView");
    makerView.hidden = view !== "maker";
    studioView.hidden = view !== "studio";
    communityView.hidden = view !== "community";
    document.title = documentTitleForView(view, locale);
    syncLanguageNav(root, locale, view);
    if (view !== "studio") {
      stopPlayback();
      cancelExport();
      closeExportDialog();
    }
    const firstPaint = activeView === null;
    if (activeView !== view) {
      const enterStudio = view === "studio";
      activeView = view;
      window.scrollTo(0, 0);
      if (enterStudio) trackEvent(MAKE_OPEN_EVENT);
      if (!firstPaint && (view === "maker" || view === "studio")) {
        focusViewHeading(view);
      }
    }
    const paintGen = ++embedPaintGen;
    if (view === "community") {
      const { communityJumpsSectionHtml, mountCommunityJumps, refreshCommunityJumps } = await import(
        "./community-list.ts"
      );
      if (paintGen !== embedPaintGen) return;
      if (!communityView.querySelector("#communityJumps")) {
        communityView.innerHTML = communityJumpsSectionHtml(undefined, locale);
        syncLanguageNav(root, locale, view);
      }
      void applyJaPhrasePolyfill(communityView, locale);
      if (!firstPaint) {
        focusViewHeading("community");
      }
      const section = must(root, "#communityJumps");
      whenEmbedHostVisible(communityView, () => {
        if (paintGen !== embedPaintGen) return;
        if (!communityMounted) {
          mountCommunityJumps(section);
          communityMounted = true;
        } else {
          refreshCommunityJumps(section);
        }
      });
      return;
    }
    if (view === "studio") {
      armStudio();
      return;
    }
    const embed = must(root, "#reactionsEmbed");
    whenEmbedHostVisible(makerView, () => {
      if (paintGen !== embedPaintGen) return;
      const paintReactions = () => remountReactionEmbed(embed, reactionEmbedHtml());
      if (!makerReactionsArmed) {
        makerReactionsArmed = true;
        whenNearViewport(embed, () => {
          if (paintGen !== embedPaintGen) return;
          paintReactions();
        });
        return;
      }
      paintReactions();
    });
  };

  const applyAspect = (next: AspectMode) => {
    if (next === mode) return;
    const inPreview = activeView === "studio";
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
    compositor?.setAspect(mode);
    stage.dataset.aspect = mode;
    syncAspectRadios(mode);
    video.dataset.templateSrc = TEMPLATES[mode].video;
    video.removeAttribute("src");
    video.preload = "none";
    if (photos.length > 0 || activeView === "studio" || recording) {
      beginTemplateVideoLoad(video);
    }
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

  const applyCharacterSize = (next: CharacterSize) => {
    if (next === characterSize) return;
    characterSize = next;
    syncCharacterRadios(characterSize);
    paint();
  };

  video.addEventListener("loadeddata", () => {
    void (async () => {
      await ensureTimelines();
      paint();
      refreshButtons();
      if (!recording && photos.length === 0) syncSeek();
      const resume = aspectResume;
      aspectResume = null;
      if (!resume || activeView !== "studio" || recording) return;
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
        setErrorFeedback("preview", error, "statusPreviewResumeFailed");
      }
    })();
  });
  video.addEventListener("ended", () => {
    if (recording) return;
    if (!shouldLoopPreviewPlayback({ recording, playing })) {
      stopPlayback();
      paint();
      return;
    }
    const gen = playGen;
    void (async () => {
      try {
        await seekVideo(video, 0);
        if (gen !== playGen || !shouldLoopPreviewPlayback({ recording, playing })) return;
        paint();
        await video.play();
        if (gen !== playGen) video.pause();
      } catch (error) {
        if (gen !== playGen) return;
        playing = false;
        previewTracked = false;
        haltLoop();
        video.pause();
        paint();
        refreshButtons();
        setErrorFeedback("preview", error, "statusPlayFailed");
      }
    })();
  });
  video.addEventListener("error", () => {
    if (recording) return;
    const code = video.error?.code;
    setErrorFeedback(
      "preview",
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

  const rejectPhotos = (reason: string) => {
    trackEvent(PHOTOS_REJECTED_EVENT, { reason });
  };

  const ingestPhotoFiles = async (incoming: readonly File[]) => {
    if (photosLocked()) return;
    if (incoming.length === 0) return;
    const capped = takeUpToPhotoCap(photos.length, incoming);
    if (capped.length === 0) {
      rejectPhotos("at_cap");
      setFeedback("photo", msg("makerPhotosAtCap", { n: PHOTO_MAX_COUNT }), "error");
      return;
    }
    const imageFiles = selectImageFiles(capped);
    if (imageFiles.length === 0) {
      rejectPhotos("not_image");
      setFeedback("photo", msg("statusPickImages"), "error");
      return;
    }
    beginTemplateVideoLoad(video);
    photosBusy = true;
    refreshButtons();
    setFeedback("photo", msg("statusPhotosLoading"), "busy");
    try {
      const compositorReady = ensureCompositor();
      const added = await loadPhotos(imageFiles, {
        onProgress: (current, total) => {
          setFeedback("photo", msg("statusPhotosLoadingProgress", { current, total }), "busy");
        },
      });
      photos = appendAll(photos, added);
      renderThumbs();
      await compositorReady;
      await ensureTimelines();
      paint();
      if (added.length === 0) {
        rejectPhotos("decode");
        setFeedback("photo", msg("statusPickImages"), "error");
        return;
      }
      trackEvent(PHOTOS_SELECTED_EVENT, { count: added.length });
      clearFeedback("photo");
    } catch (error) {
      renderThumbs();
      paint();
      rejectPhotos(error instanceof Error && error.message === HEIC_UNSUPPORTED_MESSAGE ? "heic" : "decode");
      setErrorFeedback("photo", error, "statusLoadFailed");
    } finally {
      photosBusy = false;
      refreshButtons();
    }
  };

  picker.addEventListener("click", () => {
    if (picker.disabled) return;
    trackEvent(PHOTO_PICKER_OPEN_EVENT, undefined, { debounceMs: 600 });
  });

  studioEmpty.addEventListener("click", () => {
    if (studioEmpty.hidden || studioEmpty.disabled || picker.disabled) return;
    picker.click();
  });

  picker.addEventListener("change", () => {
    const files = [...(picker.files ?? [])];
    picker.value = "";
    void ingestPhotoFiles(files);
  });

  const togglePreviewPlay = () => {
    if (isPreviewPlaying() || playbackBusy) {
      pausePlayback();
      return;
    }
    void startPlayback(false);
  };

  stage.addEventListener("click", (event) => {
    if (!studioEmpty.hidden || photos.length === 0) return;
    const target = event.target;
    if (target instanceof Node && previewTransport.contains(target)) return;
    if (!chromeOpen) {
      setChromeOpen(true);
      return;
    }
    togglePreviewPlay();
  });

  const endSeek = () => {
    seeking = false;
    syncSeek();
  };
  previewSeek.addEventListener("pointerdown", () => {
    seeking = true;
  });
  previewSeek.addEventListener("pointerup", endSeek);
  previewSeek.addEventListener("pointercancel", endSeek);
  previewSeek.addEventListener("change", endSeek);
  previewSeek.addEventListener("input", () => {
    seeking = true;
    scrubTo(Number(previewSeek.value));
    syncSeek();
  });
  video.addEventListener("timeupdate", syncSeek);
  video.addEventListener("durationchange", syncSeek);
  video.addEventListener("loadedmetadata", syncSeek);

  previewToggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (previewToggle.disabled) return;
    togglePreviewPlay();
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
    void savePendingExport();
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
    if (recording || sharingExport || photos.length === 0) return;
    recording = true;
    stopPlayback();
    video.muted = false;
    playing = false;
    previewTracked = false;
    video.pause();
    refreshButtons();
    exportSaveTracked = false;
    const controller = new AbortController();
    exportAbort = controller;
    trackEvent(GENERATE_START_EVENT, { count: photos.length });
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
      pendingExport = { blob: result.blob, filename, mime: result.mime, extension: result.extension };
      exportAbort = null;
      showExportReady();
      if (exportDialog.open) downloadExportBtn.focus();
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        trackEvent(GENERATE_CANCEL_EVENT);
        setFeedback("save", msg("statusExportCancelled"));
      } else {
        trackEvent(GENERATE_FAIL_EVENT, { reason: generateFailReason(error) });
        setErrorFeedback("save", error, "statusSaveFailed");
      }
    } finally {
      exportAbort = null;
      compositor?.setResolutionScale(PREVIEW_RESOLUTION_SCALE);
      recording = false;
      playing = false;
      previewTracked = false;
      haltLoop();
      video.pause();
      applyPreviewMute();
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
      setFeedback("share", msg("statusHashtagsCopied"));
    } else {
      setFeedback("share", msg("statusCopyUnsupported", { text: SHARE_TEXT }), "error");
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
      setFeedback("share", msg("statusShared"));
    } else if (outcome === "copied") {
      setFeedback("share", msg("statusHashtagsCopied"));
    } else if (outcome === "cancelled") {
      setFeedback("share", msg("statusShareCancelled"));
    } else {
      setFeedback("share", msg("statusShareUnsupported", { text: SHARE_TEXT }), "error");
    }
  });

  const goToView = (view: AppView) => {
    const next = `${pathForApp(locale, view)}${location.search}`;
    if (`${location.pathname}${location.search}` !== next) {
      history.pushState({ view, locale }, "", next);
    }
    void applyView(view);
  };

  const syncViewFromLocation = () => {
    const next = canonicalAppUrl(location);
    if (next) history.replaceState(history.state, "", next);
    return applyView(parseAppLocation(location).view);
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
    // プライバシーと利用規約は別ページ。メーカー内の表示切替にはしない。
    if (clicked.view === "privacy" || clicked.view === "terms") return;
    event.preventDefault();
    goToView(clicked.view);
  });

  window.addEventListener("popstate", () => {
    void applyView(parseAppView(location));
  });
  window.addEventListener("hashchange", () => {
    void syncViewFromLocation();
  });
  await syncViewFromLocation();
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
  if (video.preload === "auto" && current === src) return;
  video.preload = "auto";
  video.src = src;
  video.load();
}

function must(root: ParentNode, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

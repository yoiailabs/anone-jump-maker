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
import { previewResolutionScale } from "./canvas-size.ts";
import type { CharacterFrame, Compositor } from "./compositor.ts";
import { readPreviewBenchFlags, summarizePaintSamples } from "./preview-bench.ts";
import {
  EXPORT_FPS,
  exportJumpVideo,
  exportProgressPercent,
  isAbortError,
  markCharacterVideoUsed,
  rewindCharacterVideo,
  seekVideo,
  throwIfAborted,
} from "./export.ts";
import {
  DEFAULT_ASPECT,
  DEFAULT_CHARACTER_SIZE,
  DEFAULT_SWAP_STYLE,
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
import {
  planTemplateAudio,
  templateAudioClock,
  templateAudioIsSeparate,
  templateAudioNeedsSeek,
  type TemplateAudioFollow,
} from "./template-audio.ts";
import { nextSoundtrackSrc, portraitSoundtrackIfReady, preparePortraitSoundtrack } from "./template-audio-source.ts";
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
import {
  HEIC_UNSUPPORTED_MESSAGE,
  loadPhotos,
  revokePhotos,
  selectImageFiles,
  type LoadedPhoto,
} from "./photos.ts";
import { setPhotoThumbsHandlers, setPhotoThumbsState } from "./photo-thumbs-store.ts";
import { PREVIEW_FPS, previewStartTrigger, startVideoPaintLoop } from "./playback.ts";
import { studioTrace } from "./perf-trace.ts";
import {
  formatPreviewClock,
  PREVIEW_MUTED_DEFAULT,
  previewSurfaceChromeAction,
  shouldLoopPreviewPlayback,
  shouldRevealPreviewChrome,
  shouldSeekPreviewToStart,
  shouldTrackPreviewStart,
  syncMuteControl,
} from "./preview.ts";
import { setPreviewChromeState } from "./preview-chrome-store.ts";
import { downloadBlob } from "./recorder.ts";
import { reportError } from "./sentry.ts";
import { canShareFiles, shareVideoFile, videoFileForShare } from "./share.ts";
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
  const saveBtn = must(root, "#saveBtn") as HTMLButtonElement;
  const picker = must(root, "#picker") as HTMLInputElement;
  const previewSeek = must(root, "#previewSeek") as HTMLInputElement;
  const previewTime = must(root, "#previewTime");
  const studioEmpty = must(root, "#studioEmpty") as HTMLButtonElement;
  const exportPanel = must(root, "#exportPanel");
  const exportTitle = must(root, "#exportTitle");
  const exportStatus = must(root, "#exportStatus");
  const exportProgress = must(root, "#exportProgress") as HTMLProgressElement;
  const exportProgressLabel = must(root, "#exportProgressLabel");
  const exportKeepOpen = must(root, "#exportKeepOpen");
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
  let swapStyle: SwapStyle = swapValue && isSwapStyle(swapValue) ? swapValue : DEFAULT_SWAP_STYLE;
  let imageFilter: ImageFilter = filterValue && isImageFilter(filterValue) ? filterValue : "none";
  let characterSize: CharacterSize =
    characterValue && isCharacterSize(characterValue) ? characterValue : DEFAULT_CHARACTER_SIZE;
  const video = createTemplateVideo(mode);
  stage.dataset.aspect = mode;
  document.body.append(video);

  // 縦の音声だけ別要素。横の書き出し中に置くと WebKit が映像の seeked を遅らせ、
  // フレームごとにシークタイムアウト（2.5s）まで待って保存が終わらない。
  // `<audio>` ではなく playsinline の video。iOS は audio 要素を着信スイッチで消し、
  // 絵の video が鳴り始めると先に再生した audio を止める。ソースは音声だけの MP4。
  let audio: HTMLVideoElement | null = null;
  let audioPlayBlocked = false;
  let audioPlayPending = false;
  let audioPlayTicket = 0;
  let audioSeekOnReady = false;
  let audioRelease: Promise<void> = Promise.resolve();
  // src を外したあとの currentTime は 0。画角をまたいで再生するときは外す前の時刻。
  let pinnedAudioTime: number | null = null;
  const pictureClock = () => templateAudioClock(video.currentTime, pinnedAudioTime);

  const syncMuteChrome = () => {
    syncMuteControl(muteBtn, previewMuted, locale);
    muteBtn.setAttribute("aria-pressed", previewMuted ? "false" : "true");
  };

  const releaseTemplateAudio = (): Promise<void> => {
    const element = audio;
    if (!element) return audioRelease;
    audio = null;
    audioPlayBlocked = false;
    audioPlayPending = false;
    audioSeekOnReady = false;
    audioPlayTicket += 1;
    audioRelease = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        element.remove();
        resolve();
      };
      element.addEventListener("emptied", finish, { once: true });
      element.pause();
      element.removeAttribute("src");
      element.load();
      window.setTimeout(finish, 1000);
    });
    return audioRelease;
  };

  const ensureTemplateAudio = (): HTMLVideoElement => {
    if (audio) return audio;
    const element = document.createElement("video");
    element.className = "offscreen-video";
    element.dataset.soundtrack = "portrait";
    element.playsInline = true;
    element.setAttribute("playsinline", "");
    element.setAttribute("webkit-playsinline", "");
    element.preload = "none";
    element.controls = false;
    element.disablePictureInPicture = true;
    element.addEventListener("loadedmetadata", () => {
      if (!audioSeekOnReady || element !== audio || recording) return;
      seekAudioToPicture(element);
    });
    document.body.append(element);
    audio = element;
    return element;
  };

  const assignAudioSrc = (element: HTMLVideoElement) => {
    const file = TEMPLATES[mode].audio;
    const src = nextSoundtrackSrc({
      current: element.getAttribute("src"),
      prepared: portraitSoundtrackIfReady(file),
      file,
      paused: element.paused,
    });
    if (!src) return;
    element.preload = "auto";
    element.src = src;
  };

  const seekAudioToPicture = (element: HTMLVideoElement) => {
    const clock = pictureClock();
    if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
      audioSeekOnReady = true;
      return;
    }
    if (audioPlayPending) {
      audioSeekOnReady = true;
      return;
    }
    if (element.seeking) return;
    if (!templateAudioNeedsSeek(element.currentTime, clock)) {
      audioSeekOnReady = false;
      return;
    }
    audioSeekOnReady = false;
    element.currentTime = clock;
  };

  const requestAudioPlay = (element: HTMLVideoElement) => {
    const ticket = ++audioPlayTicket;
    audioPlayPending = true;
    void element.play().then(
      () => {
        if (ticket !== audioPlayTicket) return;
        audioPlayPending = false;
        audioPlayBlocked = false;
        if (audioSeekOnReady && element === audio) seekAudioToPicture(element);
      },
      (error: unknown) => {
        if (ticket !== audioPlayTicket) return;
        audioPlayPending = false;
        const denied = error instanceof DOMException && error.name === "NotAllowedError";
        audioPlayBlocked = denied && element.paused;
      },
    );
  };

  const followTemplateAudio = (patch: Pick<TemplateAudioFollow, "userGesture" | "picturePlaying" | "allowPlay">) => {
    const plan = planTemplateAudio({
      mode,
      previewMuted,
      exporting: recording,
      playBlocked: audioPlayBlocked,
      playPending: audioPlayPending,
      audioPaused: audio?.paused ?? true,
      audioReady: (audio?.readyState ?? 0) >= HTMLMediaElement.HAVE_METADATA,
      audioTime: audio?.currentTime ?? 0,
      videoTime: pictureClock(),
      ...patch,
    });
    // 書き出し中に muted を false→true へ戻すと、WebKit は seeking のまま seeked を出さない。
    if (!recording) {
      video.muted = plan.pictureMuted;
      video.volume = 1;
    }
    if (plan.release) {
      void releaseTemplateAudio();
      syncMuteChrome();
      return;
    }
    if (!plan.play && !plan.seek && !audio) {
      syncMuteChrome();
      return;
    }
    const element = ensureTemplateAudio();
    element.muted = plan.audioMuted;
    element.volume = 1;
    if (plan.play || plan.seek) assignAudioSrc(element);
    // 音声だけの URL がまだ無いあいだは play() しない。元の映像ファイルで src を固定しない。
    if (!element.getAttribute("src")) {
      syncMuteChrome();
      return;
    }
    if (plan.play || plan.seek) seekAudioToPicture(element);
    if (plan.play) requestAudioPlay(element);
    syncMuteChrome();
  };

  const pauseCompanionAudio = () => {
    if (recording || playbackBusy) return;
    audio?.pause();
  };

  video.addEventListener("play", () => {
    if (recording) return;
    followTemplateAudio({ userGesture: false, picturePlaying: true, allowPlay: true });
  });
  // 絵の pause では音声を止めない。シーク・画角の読み直し・ループの頭出しが
  // video.pause() を呼び、そのたびに音声を止めると iOS は次の play() を拒否する。
  // ユーザーの停止は pausePlayback / stopPlayback が明示的に止める。
  video.addEventListener("seeked", () => {
    if (recording || !audio || !templateAudioIsSeparate(mode)) return;
    seekAudioToPicture(audio);
  });
  video.addEventListener("timeupdate", () => {
    if (recording || !audio || !templateAudioIsSeparate(mode) || video.paused) return;
    // 止まった音声の再開はする。シークはプランが「ずれている」と判断したときだけ。
    followTemplateAudio({ userGesture: false, picturePlaying: true, allowPlay: true });
  });

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
          resolutionScale: previewResolutionScale(mode),
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

  const canUse = () =>
    photos.length > 0 &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    (!templateAudioIsSeparate(mode) || portraitSoundtrackIfReady(TEMPLATES.portrait.audio) !== undefined);

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
    const exporting = recording;
    const watchPreview =
      !exporting && (studioTrace.wantsPaintSample() || studioTrace.waitingForMovingPaint());
    const timing = benchFlags.bench || watchPreview;
    const started = timing ? performance.now() : 0;
    const cuts = timeline();
    compositor.draw(video, photos, cuts, time, swapStyle, imageFilter, character, characterSize);
    const duration = timing ? performance.now() - started : 0;
    if (benchFlags.bench) {
      if (paintClockStart === 0) paintClockStart = started;
      paintSamples.push(duration);
    }
    refreshBenchFlag();
    if (exporting) return;
    studioTrace.noteCompositePaint({
      currentTime: video.currentTime,
      paused: video.paused === true,
      exporting: false,
      templateReady: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      hasPhotos: photos.length > 0,
      timelinesReady: true,
      compositorReady: true,
    });
    if (watchPreview && studioTrace.wantsPaintSample() && video.paused !== true) {
      studioTrace.notePaintSample(duration);
    }
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
      resolutionScale: compositor?.resolutionScale() ?? previewResolutionScale(mode),
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
    followTemplateAudio({ userGesture: false, picturePlaying: isPreviewPlaying(), allowPlay: false });
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
    studioTrace.onPreviewStop("stop");
    playGen += 1;
    playbackBusy = false;
    playing = false;
    previewTracked = false;
    haltLoop();
    video.pause();
    pauseCompanionAudio();
    refreshButtons();
  };

  const pausePlayback = () => {
    studioTrace.onPreviewStop("stop");
    playGen += 1;
    playbackBusy = false;
    playing = false;
    suppressPlayUntil = Date.now() + 350;
    haltLoop();
    video.pause();
    pauseCompanionAudio();
    paint();
    refreshButtons();
  };

  const startPlayback = async (fromStart: boolean, entry: "user" | "aspect_resume" = "user") => {
    if (recording || playbackBusy || !canUse()) return;
    if (!fromStart && Date.now() < suppressPlayUntil) return;
    // await より前。play() がジェスチャの外に出ると WebKit は拒否し、ミュート解除でも戻らない。
    // 絵を先に play してから音声を play する。逆だと iOS は後から鳴った video に音声を止める。
    if (entry === "user" && templateAudioIsSeparate(mode)) {
      video.muted = true;
      if (video.paused) void video.play().catch(() => {});
    }
    followTemplateAudio({
      userGesture: entry === "user",
      picturePlaying: true,
      allowPlay: true,
    });
    playbackBusy = true;
    const gen = (playGen += 1);
    const durationAtStart = Number.isFinite(video.duration) ? video.duration : 0;
    const attempt = studioTrace.beginPreviewStart({
      trigger: previewStartTrigger({
        aspectResume: entry === "aspect_resume",
        fromStart,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: durationAtStart,
      }),
      aspect: mode,
      effect: swapStyle,
      filter: imageFilter,
      character_size: characterSize,
      has_photos: photos.length > 0,
    });
    try {
      await ensureTimelines();
      if (gen !== playGen) {
        studioTrace.finishPreviewStartIfCurrent(attempt, "superseded", { end_reason: "superseded" });
        return;
      }
      trackPreviewStart();
      applyPreviewMute();
      const rewindRequired = shouldSeekPreviewToStart({
        fromStart,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      });
      studioTrace.annotatePreviewStart({ rewind_required: rewindRequired });
      if (rewindRequired) {
        compositor?.resetCharacter();
        await rewindCharacterVideo(video);
      }
      markCharacterVideoUsed(video);
      if (gen !== playGen) {
        studioTrace.finishPreviewStartIfCurrent(attempt, "superseded", { end_reason: "superseded" });
        return;
      }
      playing = true;
      clearFeedback("preview");
      refreshButtons();
      await startLoop();
      if (gen !== playGen) {
        studioTrace.finishPreviewStartIfCurrent(attempt, "superseded", { end_reason: "superseded" });
        return;
      }
      const playSpan = studioTrace.openPreviewChild("preview.play_request");
      try {
        await video.play();
        playSpan?.end("success");
      } catch (error) {
        playSpan?.end(error instanceof Error && error.name === "AbortError" ? "cancelled" : "error");
        throw error;
      }
      if (gen !== playGen) {
        video.pause();
        studioTrace.finishPreviewStartIfCurrent(attempt, "superseded", { end_reason: "superseded" });
        return;
      }
      video.blur();
      studioTrace.armFirstMovingPaint(video.currentTime);
    } catch (error) {
      if (gen !== playGen) {
        studioTrace.finishPreviewStartIfCurrent(attempt, "superseded", { end_reason: "superseded" });
        return;
      }
      studioTrace.finishPreviewStartIfCurrent(attempt, "error");
      playing = false;
      previewTracked = false;
      haltLoop();
      audio?.pause();
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
    // 追い越されたシークは currentTime がずれて「シークがタイムアウトしました」になる。
    // 待ちを捨てる。タイマーの再試行はしない（背面タブではタイマーが止まる）。
    void seekVideo(video, time).then(
      () => {
        if (gen !== seekGen) return;
        paint();
        refreshButtons();
      },
      (error: unknown) => {
        if (gen !== seekGen || isAbortError(error)) return;
        setErrorFeedback("preview", error, "statusPlayFailed");
      },
    );
  };

  const setExportProgress = (percent: number) => {
    const value = Math.min(100, Math.max(0, percent));
    exportProgress.value = value;
    setTextIfChanged(exportProgressLabel, msg("exportPercent", { percent: value }));
    setTextIfChanged(exportStatus, "");
    exportStatus.hidden = true;
  };

  const fileShareAvailable = () => {
    if (!pendingExport) return false;
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    return canShareFiles(nav, [videoFileForShare(pendingExport.blob, pendingExport.filename, pendingExport.mime)]);
  };

  const setExportPhase = (phase: "busy" | "done") => {
    exportPanel.dataset.exportPhase = phase;
    exportTitle.textContent = phase === "done" ? msg("exportDoneTitle") : msg("exportTitle");
    exportKeepOpen.hidden = phase !== "busy";
    cancelExportBtn.hidden = phase !== "busy";
    downloadExportBtn.hidden = phase !== "done";
    downloadExportBtn.classList.remove("ghost");
    closeExportBtn.hidden = phase !== "done";
    if (phase === "done") exportPanel.removeAttribute("aria-describedby");
    else exportPanel.setAttribute("aria-describedby", "exportKeepOpen");
  };

  const revealExportPanel = () => {
    exportPanel.dataset.open = "true";
    exportPanel.scrollIntoView({ block: "center", inline: "nearest" });
  };

  const openExportPanel = () => {
    clearFeedback("save");
    pendingExport = null;
    cancelExportBtn.disabled = false;
    setExportPhase("busy");
    setExportProgress(0);
    revealExportPanel();
    exportPanel.focus({ preventScroll: true });
  };

  const closeExportPanel = () => {
    pendingExport = null;
    delete exportPanel.dataset.open;
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

  const showExportReady = () => {
    setExportProgress(100);
    setExportPhase("done");
  };

  const downloadPendingExport = (pending: NonNullable<typeof pendingExport>) => {
    downloadBlob(pending.blob, pending.filename);
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
      const outcome = await shareVideoFile({
        blob: pending.blob,
        filename: pending.filename,
        mime: pending.mime,
        navigator: typeof navigator === "undefined" ? undefined : navigator,
      });
      if (outcome === "cancelled") return;
      if (outcome === "shared") {
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

  const loadTemplatePicture = () => {
    beginTemplateVideoLoad(video);
    void preparePortraitSoundtrack(TEMPLATES.portrait.audio).then(() => {
      refreshButtons();
      if (recording || !templateAudioIsSeparate(mode) || !isPreviewPlaying()) return;
      followTemplateAudio({ userGesture: false, picturePlaying: true, allowPlay: true });
    });
  };

  const armStudio = () => {
    loadTemplatePicture();
    const resources = studioTrace.openPreviewResourcesSpan();
    void ensureCompositor()
      .then(() => {
        resources?.end("success");
        paint();
        syncSeek();
      })
      .catch((error: unknown) => {
        resources?.end("error");
        studioTrace.finishPreviewOpen("error");
        setErrorFeedback("preview", error, "statusPreviewOpenFailed");
      });
  };

  let communityMounted = false;
  let studioEntered = false;
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
    const enteringStudio = view === "studio" && activeView !== "studio";
    if (view !== "studio") {
      studioTrace.onLeaveStudio();
      stopPlayback();
      cancelExport();
      closeExportPanel();
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
      if (enteringStudio) {
        const entry = studioEntered ? "reopen" : "initial";
        studioEntered = true;
        studioTrace.beginPreviewOpen({
          entry,
          has_photos: photos.length > 0,
          timelines_ready: timelines != null,
          compositor_ready: compositor != null,
          template_ready: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        });
      }
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
    studioTrace.onPreviewStop("settings");
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
    if (!recording) compositor?.setResolutionScale(previewResolutionScale(mode));
    stage.dataset.aspect = mode;
    syncAspectRadios(mode);
    video.dataset.templateSrc = TEMPLATES[mode].video;
    video.dataset.templateAudio = TEMPLATES[mode].audio;
    pinnedAudioTime = aspectResume?.play && templateAudioIsSeparate(mode) ? aspectResume.time : null;
    video.removeAttribute("src");
    video.preload = "none";
    void releaseTemplateAudio();
    applyPreviewMute();
    if (photos.length > 0 || activeView === "studio" || recording) {
      loadTemplatePicture();
    }
    if (aspectResume?.play && templateAudioIsSeparate(mode)) {
      video.muted = true;
      void video.play().catch(() => {});
      followTemplateAudio({ userGesture: true, picturePlaying: true, allowPlay: true });
    }
    refreshButtons();
  };

  const applySwap = (next: SwapStyle) => {
    if (next === swapStyle) return;
    studioTrace.onPreviewStop("settings");
    swapStyle = next;
    syncSwapRadios(swapStyle);
    paint();
  };

  const applyFilter = (next: ImageFilter) => {
    if (next === imageFilter) return;
    studioTrace.onPreviewStop("settings");
    imageFilter = next;
    syncFilterRadios(imageFilter);
    paint();
  };

  const applyCharacterSize = (next: CharacterSize) => {
    if (next === characterSize) return;
    studioTrace.onPreviewStop("settings");
    characterSize = next;
    syncCharacterRadios(characterSize);
    paint();
  };

  video.addEventListener("loadeddata", () => {
    void (async () => {
      if (recording) return;
      await ensureTimelines();
      paint();
      refreshButtons();
      if (!recording && photos.length === 0) syncSeek();
      const resume = aspectResume;
      aspectResume = null;
      if (!resume || activeView !== "studio" || recording) {
        pinnedAudioTime = null;
        return;
      }
      previewTracked = resume.tracked;
      try {
        await seekVideo(video, resume.time);
        pinnedAudioTime = null;
        paint();
        if (resume.play) {
          await startPlayback(false, "aspect_resume");
        } else {
          refreshButtons();
        }
      } catch (error) {
        pinnedAudioTime = null;
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
        compositor?.resetCharacter();
        await rewindCharacterVideo(video);
        markCharacterVideoUsed(video);
        if (gen !== playGen || !shouldLoopPreviewPlayback({ recording, playing })) return;
        paint();
        await video.play();
        if (gen !== playGen) video.pause();
      } catch (error) {
        if (gen !== playGen) return;
        studioTrace.onPreviewStop("stop");
        playing = false;
        previewTracked = false;
        haltLoop();
        video.pause();
        pauseCompanionAudio();
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
    loadTemplatePicture();
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
    if (target instanceof Node && (previewTransport.contains(target) || previewToggle.contains(target))) return;
    const action = previewSurfaceChromeAction({ chromeOpen, playing: isPreviewPlaying() });
    if (action === "show") setChromeOpen(true);
    else if (action === "hide") setChromeOpen(false);
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
    followTemplateAudio({ userGesture: true, picturePlaying: isPreviewPlaying(), allowPlay: true });
  });

  cancelExportBtn.addEventListener("click", () => {
    cancelExport();
  });

  downloadExportBtn.addEventListener("click", () => {
    void savePendingExport();
  });

  closeExportBtn.addEventListener("click", () => {
    closeExportPanel();
  });

  window.addEventListener("beforeunload", (event) => {
    if (!recording) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") studioTrace.onHidden();
  });
  window.addEventListener("pagehide", (event) => {
    studioTrace.onPageHide(event.persisted);
  });

  const startSave = async () => {
    if (recording || sharingExport || photos.length === 0) return;
    studioTrace.onGenerationStart();
    recording = true;
    stopPlayback();
    // 別音声を emptied まで待ってから映像をシークする。要素が残ると WebKit は seeked を出さず、
    // 短い書き出しでもフレーム数 × 2.5s で保存結果が返らない。
    // ここでは muted を変えない。offscreen の video を false から true に戻すと、同じ理由で seeked が止まる。
    await releaseTemplateAudio();
    playing = false;
    previewTracked = false;
    video.pause();
    refreshButtons();
    exportSaveTracked = false;
    const controller = new AbortController();
    exportAbort = controller;
    trackEvent(GENERATE_START_EVENT, { count: photos.length });
    openExportPanel();
    try {
      studioTrace.beginExport({
        export_path: "offline",
        aspect: mode,
        effect: swapStyle,
        filter: imageFilter,
        character_size: characterSize,
        has_photos: true,
      });
      const prepared = await studioTrace.withExportChild("export.prepare", async () => {
        const cuts = (await ensureTimelines())[mode];
        throwIfAborted(controller.signal);
        const duration =
          Number.isFinite(video.duration) && video.duration > 0 ? video.duration : cuts.duration;
        const fps = cuts.fps && cuts.fps > 0 ? cuts.fps : EXPORT_FPS;
        const comp = await ensureCompositor();
        throwIfAborted(controller.signal);
        comp.resetCharacter();
        comp.setResolutionScale(1);
        studioTrace.annotateExport({
          width: comp.canvas.width,
          height: comp.canvas.height,
          fps,
          duration_sec: Math.round(duration * 1000) / 1000,
        });
        return { duration, fps, comp };
      });
      const result = await exportJumpVideo({
        video,
        canvas: prepared.comp.canvas,
        draw: paint,
        duration: prepared.duration,
        fps: prepared.fps,
        audioSrc: TEMPLATES[mode].audio,
        signal: controller.signal,
        onProgress: (progress) => {
          setExportProgress(exportProgressPercent(progress.current, progress.total));
        },
      });
      const filename = exportFileName(mode, swapStyle, result.extension, imageFilter);
      pendingExport = { blob: result.blob, filename, mime: result.mime, extension: result.extension };
      exportAbort = null;
      showExportReady();
      studioTrace.finishExport("success");
      if (exportPanel.dataset.open === "true") downloadExportBtn.focus({ preventScroll: true });
      revealExportPanel();
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        studioTrace.finishExport("cancelled");
        trackEvent(GENERATE_CANCEL_EVENT);
      } else {
        studioTrace.finishExport("error");
        trackEvent(GENERATE_FAIL_EVENT, { reason: generateFailReason(error) });
        setErrorFeedback("save", error, "statusSaveFailed");
      }
    } finally {
      studioTrace.finishExportIfOpen("error");
      exportAbort = null;
      compositor?.setResolutionScale(previewResolutionScale(mode));
      recording = false;
      playing = false;
      previewTracked = false;
      haltLoop();
      video.pause();
      applyPreviewMute();
      if (!pendingExport) closeExportPanel();
      refreshButtons();
      paint();
    }
  };

  saveBtn.addEventListener("click", () => {
    void startSave();
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
  video.dataset.templateAudio = TEMPLATES[mode].audio;
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

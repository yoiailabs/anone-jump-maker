import { createCompositor } from "./compositor.ts";
import { recordRealtime, seekVideo, signalCanvasPainted } from "./export.ts";
import { isAspectMode, TEMPLATES, type AspectMode } from "./layout.ts";
import { loadPhotos, revokePhotos, type LoadedPhoto } from "./photos.ts";
import { startVideoPaintLoop } from "./playback.ts";
import { downloadBlob, resumeRecordingAudio } from "./recorder.ts";
import { fetchGenerateCount, formatCountLabel, recordGenerate } from "./stats.ts";
import { shouldCountPreview } from "./stats-shared.ts";
import type { CutTimeline } from "./timeline.ts";

type StatusKind = "idle" | "busy" | "error";

export async function boot(root: HTMLElement): Promise<void> {
  const timelines = await loadTimelines();
  const compositor = createCompositor();
  const video = createTemplateVideo("portrait");

  let mode: AspectMode = "portrait";
  let photos: LoadedPhoto[] = [];
  let playing = false;
  let recording = false;
  let previewCounted = false;
  let stopLoop: (() => void) | null = null;
  let lastSlot = -1;

  root.innerHTML = `
    <div class="sky" aria-hidden="true">
      <span class="blob blob-lime"></span>
      <span class="blob blob-teal"></span>
      <span class="blob blob-coral"></span>
      <span class="wind"></span>
    </div>
    <div class="app">
      <header class="hero">
        <div class="breeze" aria-hidden="true"></div>
        <p class="eyebrow">#あのねジャンプ</p>
        <h1>あのねジャンプメーカー</h1>
        <p class="lede">写真を置くと、ジャンプの拍で入れ替わります。ベタ塗りの後ろだけ抜けて、線のキャラはそのまま。たてにも、よこにも。この端末の中だけの、小さな夏。</p>
        <p class="made-count" id="madeCount">—回作られたよ</p>
      </header>

      <section class="stage-wrap">
        <div class="stage" id="stage" data-aspect="portrait"></div>
        <p class="empty-hint" id="emptyHint">まだ写真はありません。向きを選んで、下から置くと色が入ります。</p>
        <p class="slot-meter" id="slotMeter">スロット — / ${timelines.portrait.slots.length}</p>
      </section>

      <section class="panel">
        <fieldset class="aspect-field">
          <legend>書き出す向き</legend>
          <div class="aspect-toggle" role="radiogroup" aria-label="書き出す向き">
            <label>
              <input type="radio" name="aspect" value="portrait" checked />
              <span>縦<small>9:16</small></span>
            </label>
            <label>
              <input type="radio" name="aspect" value="landscape" />
              <span>横<small>16:9</small></span>
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
  const madeCount = must(root, "#madeCount");
  const aspectInputs = [...root.querySelectorAll<HTMLInputElement>('input[name="aspect"]')];

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
    playBtn.disabled = recording || (!playing && !canUse());
    saveBtn.disabled = recording || !canUse();
    playBtn.textContent = playing ? "停止" : "プレビュー";
    for (const input of aspectInputs) {
      input.disabled = recording;
    }
  };

  const paint = () => {
    const slots = timeline().slots;
    const slot = compositor.draw(video, photos, slots);
    if (slot !== lastSlot) {
      lastSlot = slot;
      slotMeter.textContent = `スロット ${slot + 1} / ${slots.length}`;
    }
    signalCanvasPainted();
  };

  const haltLoop = () => {
    stopLoop?.();
    stopLoop = null;
  };

  const startLoop = async () => {
    haltLoop();
    await resumeRecordingAudio(video);
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
    playing = false;
    previewCounted = false;
    haltLoop();
    video.pause();
    refreshButtons();
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
    setStatus(mode === "portrait" ? "たて（9:16）。中央が本編、上下はブラー。" : "よこ（16:9）。キャンバス全面が本編。");
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
    if (previewCounted) return;
    try {
      countPreviewStart();
      video.muted = false;
      video.volume = 1;
      await seekVideo(video, 0);
      playing = true;
      refreshButtons();
      setStatus("プレビュー中");
      await startLoop();
      await video.play();
    } catch (error) {
      playing = false;
      previewCounted = false;
      haltLoop();
      refreshButtons();
      setStatus(error instanceof Error ? error.message : "再生できませんでした", "error");
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (recording || photos.length === 0) return;
    recording = true;
    playing = false;
    previewCounted = false;
    video.pause();
    refreshButtons();
    setStatus("録画中… 画面を消さずにお待ちください", "busy");
    try {
      const result = await recordRealtime({
        video,
        canvas: compositor.canvas,
        startLoop,
      });
      const aspectTag = mode === "landscape" ? "16x9" : "9x16";
      downloadBlob(result.blob, `anone-jump-${aspectTag}.${result.extension}`);
      setStatus(`保存しました（${result.extension.toUpperCase()}）`);
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

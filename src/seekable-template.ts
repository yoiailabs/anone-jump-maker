import { DEFAULT_LOCALE, t } from "./i18n";

/** Some static hosts return 200 for media Range requests. Blob URLs provide local seeking. */
const sources = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();

async function downloadTemplate(src: string): Promise<string> {
  let pending = sources.get(src);
  if (!pending) {
    pending = fetch(src)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(t(DEFAULT_LOCALE, "statusTemplateLoadFailedCode", { code: response.status }));
        const url = URL.createObjectURL(await response.blob());
        objectUrls.add(url);
        return url;
      })
      .catch((error: unknown) => {
        sources.delete(src);
        throw error;
      });
    sources.set(src, pending);
  }
  return pending;
}

export async function ensureSeekableTemplate(
  video: HTMLVideoElement,
  target: number,
): Promise<void> {
  const inRange = Array.from(
    { length: video.seekable.length },
    (_, index) =>
      target >= video.seekable.start(index) &&
      target < video.seekable.end(index),
  ).some(Boolean);
  if (inRange || video.currentSrc.startsWith("blob:")) return;
  const src = video.dataset.templateSrc;
  if (!src) return;
  const url = await downloadTemplate(src);
  // A navigation or source change can outlive a pending network request.
  if (video.dataset.templateSrc !== src || !video.isConnected) return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    const loaded = () => finish();
    const failed = () => finish(new Error(t(DEFAULT_LOCALE, "errorTemplateDecode")));
    const timer = window.setTimeout(
      () => finish(new Error(t(DEFAULT_LOCALE, "statusTemplateLoadFailed"))),
      15000,
    );
    video.addEventListener("loadeddata", loaded, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.dataset.loadedTemplate = src;
    video.src = url;
    video.load();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
    sources.clear();
  });
}

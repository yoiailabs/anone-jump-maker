export const PWA_THEME_COLOR = "#F6EFE2";
export const PWA_BACKGROUND_COLOR = "#F6EFE2";
export const PWA_MANIFEST_HREF = "/manifest.webmanifest";
export const PWA_SERVICE_WORKER_HREF = "/sw.js";
export const PWA_APPLE_TOUCH_ICON_HREF = "/icons/apple-touch-icon.png";

const INSTALLABLE_DISPLAY = new Set(["standalone", "fullscreen", "minimal-ui"]);
const REQUIRED_ICON_SIZES = new Set(["192x192", "512x512"]);

export type PwaManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

export type PwaManifest = {
  name?: unknown;
  short_name?: unknown;
  start_url?: unknown;
  display?: unknown;
  icons?: unknown;
  prefer_related_applications?: unknown;
};

type ServiceWorkerContainerLike = {
  register: (scriptURL: string) => Promise<unknown>;
};

/** Chrome のインストール条件を満たすか。足りない項目を返す。 */
export function installabilityIssues(manifest: PwaManifest): string[] {
  const issues: string[] = [];
  const named = typeof manifest.name === "string" && manifest.name.trim().length > 0;
  const shortNamed = typeof manifest.short_name === "string" && manifest.short_name.trim().length > 0;
  if (!named && !shortNamed) issues.push("name or short_name");
  if (typeof manifest.start_url !== "string" || manifest.start_url.trim().length === 0) {
    issues.push("start_url");
  }
  if (typeof manifest.display !== "string" || !INSTALLABLE_DISPLAY.has(manifest.display)) {
    issues.push("display");
  }
  if (manifest.prefer_related_applications === true) issues.push("prefer_related_applications");

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const sizes = new Set<string>();
  for (const icon of icons) {
    if (!icon || typeof icon !== "object") continue;
    const record = icon as PwaManifestIcon;
    if (record.type !== "image/png") continue;
    const purpose = record.purpose ?? "any";
    if (purpose !== "any" && !purpose.split(/\s+/).includes("any")) continue;
    sizes.add(record.sizes);
  }
  for (const size of REQUIRED_ICON_SIZES) {
    if (!sizes.has(size)) issues.push(`icon ${size}`);
  }
  return issues;
}

export function canRegisterServiceWorker(
  protocol = typeof location === "undefined" ? "" : location.protocol,
  hostname = typeof location === "undefined" ? "" : location.hostname,
): boolean {
  if (protocol === "https:") return true;
  if (protocol !== "http:") return false;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function registerPwa(
  serviceWorker: ServiceWorkerContainerLike | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.serviceWorker,
): void {
  if (!serviceWorker?.register) return;
  if (!canRegisterServiceWorker()) return;
  void serviceWorker.register(PWA_SERVICE_WORKER_HREF).catch(() => {
    /* インストールは任意。SW 失敗でメーカーを止めない。 */
  });
}

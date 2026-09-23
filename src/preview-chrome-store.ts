export type PreviewChromeSnap = {
  playing: boolean;
  enabled: boolean;
};

const idle: PreviewChromeSnap = { playing: false, enabled: false };

let snap: PreviewChromeSnap = idle;
const listeners = new Set<() => void>();

export function getPreviewChrome(): PreviewChromeSnap {
  return snap;
}

export function subscribePreviewChrome(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setPreviewChromeState(next: PreviewChromeSnap): void {
  if (snap.playing === next.playing && snap.enabled === next.enabled) return;
  snap = next;
  for (const listener of listeners) listener();
}

export type FeedbackPlace = "photo" | "preview" | "save";
export type FeedbackKind = "idle" | "busy" | "error";

export type FeedbackSnap = {
  text: string;
  kind: FeedbackKind;
};

const empty: FeedbackSnap = { text: "", kind: "idle" };

let snaps: Record<FeedbackPlace, FeedbackSnap> = {
  photo: empty,
  preview: empty,
  save: empty,
};

const listeners = new Set<() => void>();

export function getFeedback(place: FeedbackPlace): FeedbackSnap {
  return snaps[place];
}

export function subscribeFeedback(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setFeedbackState(place: FeedbackPlace, next: FeedbackSnap): void {
  const current = snaps[place];
  if (current.text === next.text && current.kind === next.kind) return;
  snaps = { ...snaps, [place]: next };
  for (const listener of listeners) listener();
}

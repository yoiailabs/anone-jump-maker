export type ThumbPhoto = {
  id: string;
  name: string;
  thumbUrl: string;
};

export type PhotoThumbsState = {
  photos: readonly ThumbPhoto[];
  locked: boolean;
};

export type PhotoThumbsHandlers = {
  onReorder: (ids: readonly string[]) => void;
  onRemove: (id: string) => void;
};

const empty: PhotoThumbsState = { photos: [], locked: false };

let state: PhotoThumbsState = empty;
const listeners = new Set<() => void>();

const noopHandlers: PhotoThumbsHandlers = {
  onReorder: () => undefined,
  onRemove: () => undefined,
};

let handlers: PhotoThumbsHandlers = noopHandlers;

export function getPhotoThumbsState(): PhotoThumbsState {
  return state;
}

export function subscribePhotoThumbs(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function setPhotoThumbsState(next: PhotoThumbsState): void {
  if (
    state.locked === next.locked &&
    state.photos.length === next.photos.length &&
    state.photos.every(
      (photo, index) =>
        photo.id === next.photos[index]?.id &&
        photo.name === next.photos[index]?.name &&
        photo.thumbUrl === next.photos[index]?.thumbUrl,
    )
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

export function resetPhotoThumbsState(): void {
  handlers = noopHandlers;
  setPhotoThumbsState(empty);
}

export function setPhotoThumbsHandlers(next: PhotoThumbsHandlers): void {
  handlers = next;
}

export function getPhotoThumbsHandlers(): PhotoThumbsHandlers {
  return handlers;
}

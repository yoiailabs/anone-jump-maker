import { useSyncExternalStore } from "react";
export type EditorState = {
  booted: boolean;
  ready: boolean;
  locked: boolean;
  playing: boolean;
  time: number;
  duration: number;
  exported: boolean;
};
const initial: EditorState = {
  booted: false,
  ready: false,
  locked: false,
  playing: false,
  time: 0,
  duration: 0,
  exported: false,
};
let state = initial;
const listeners = new Set<() => void>();
export function setEditorState(patch: Partial<EditorState>) {
  if (
    Object.entries(patch).every(
      ([key, value]) => state[key as keyof EditorState] === value,
    )
  )
    return;
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
export function useEditor() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => initial,
  );
}
let handlers = { pause: () => {}, seek: async (_time: number) => {} };
export function setEditorHandlers(next: typeof handlers) {
  handlers = next;
}
export function pauseEditor() {
  handlers.pause();
}
export function seekEditor(time: number) {
  return handlers.seek(time);
}

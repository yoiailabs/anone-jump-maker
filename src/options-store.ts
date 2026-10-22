import { DEFAULT_ASPECT, DEFAULT_CHARACTER_SIZE, DEFAULT_SWAP_STYLE } from "./layout.ts";

const initial = {
  aspect: DEFAULT_ASPECT,
  swap: DEFAULT_SWAP_STYLE,
  color_filter: "none",
  filter: "none",
  character: DEFAULT_CHARACTER_SIZE,
};
type Options = Record<keyof typeof initial, string>;
let snap: Options = initial;
const listeners = new Set<() => void>();

export const getOptions = (): Options => snap;
export const getInitialOptions = (): Options => initial;

export function subscribeOptions(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// change を発火しない checked の更新も、実際の radio から React へ伝える。
export function syncOptions(root: HTMLElement): void {
  const next = { ...snap };
  for (const name of Object.keys(initial) as (keyof Options)[]) {
    const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
    if (input) next[name] = input.value;
  }
  if (Object.keys(initial).every((name) => next[name as keyof Options] === snap[name as keyof Options])) return;
  snap = next;
  for (const listener of listeners) listener();
}

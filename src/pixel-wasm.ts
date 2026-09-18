/** 画素ホットパス（キーイング・箱型ぼかし）の WASM。Canvas2D そのものではない。 */
export const PIXEL_ENGINE_WASM = "wasm" as const;
export const PIXEL_ENGINE_JS = "js" as const;

export type PixelEngine = typeof PIXEL_ENGINE_WASM | typeof PIXEL_ENGINE_JS;

type PixelExports = {
  memory: WebAssembly.Memory;
  key_image: (ptr: number, width: number, height: number) => void;
  box_blur_rgba: (
    dataPtr: number,
    tmpPtr: number,
    width: number,
    height: number,
    radius: number,
    passes: number,
  ) => void;
  __heap_base: { value: number };
};

let exportsRef: PixelExports | null = null;

export function pixelEngine(): PixelEngine {
  return exportsRef ? PIXEL_ENGINE_WASM : PIXEL_ENGINE_JS;
}

export function isPixelWasmReady(): boolean {
  return exportsRef !== null;
}

export async function loadPixelWasm(source: string | URL | BufferSource): Promise<boolean> {
  try {
    const bytes = await resolveWasmBytes(source);
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const next = asPixelExports(instance.exports);
    if (!next) return false;
    exportsRef = next;
    return true;
  } catch {
    exportsRef = null;
    return false;
  }
}

export function unloadPixelWasm(): void {
  exportsRef = null;
}

/** In-place RGBA key. Returns false when WASM is not ready so JS can run. */
export function keyImageDataWasm(image: ImageData): boolean {
  const wasm = exportsRef;
  if (!wasm) return false;
  const { width, height, data } = image;
  const bytes = width * height * 4;
  const ptr = reserve(wasm, bytes);
  if (ptr === null) return false;
  const view = new Uint8Array(wasm.memory.buffer, ptr, bytes);
  view.set(data);
  wasm.key_image(ptr, width, height);
  data.set(new Uint8Array(wasm.memory.buffer, ptr, bytes));
  return true;
}

/** In-place box blur. Returns false when WASM is not ready so JS can run. */
export function boxBlurRgbaWasm(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes: number,
): boolean {
  const wasm = exportsRef;
  if (!wasm) return false;
  const bytes = width * height * 4;
  const ptr = reserve(wasm, bytes * 2);
  if (ptr === null) return false;
  const view = new Uint8Array(wasm.memory.buffer, ptr, bytes);
  view.set(data);
  wasm.box_blur_rgba(ptr, ptr + bytes, width, height, radius, passes);
  data.set(new Uint8Array(wasm.memory.buffer, ptr, bytes));
  return true;
}

async function resolveWasmBytes(source: string | URL | BufferSource): Promise<BufferSource> {
  if (typeof source !== "string" && !(source instanceof URL)) {
    return source;
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error("pixel wasm を取得できませんでした");
  }
  return new Uint8Array(await response.arrayBuffer());
}

function asPixelExports(exports: WebAssembly.Exports): PixelExports | null {
  const memory = exports.memory;
  const key = exports.key_image;
  const blur = exports.box_blur_rgba;
  const heap = exports.__heap_base;
  if (!(memory instanceof WebAssembly.Memory)) return null;
  if (typeof key !== "function" || typeof blur !== "function") return null;
  if (!heap || typeof (heap as { value?: unknown }).value !== "number") return null;
  return {
    memory,
    key_image: key as PixelExports["key_image"],
    box_blur_rgba: blur as PixelExports["box_blur_rgba"],
    __heap_base: heap as PixelExports["__heap_base"],
  };
}

function reserve(wasm: PixelExports, bytes: number): number | null {
  const ptr = align16(wasm.__heap_base.value);
  const need = ptr + Math.max(0, bytes);
  if (!ensureMemory(wasm.memory, need)) return null;
  return ptr;
}

function align16(value: number): number {
  return (value + 15) & ~15;
}

function ensureMemory(memory: WebAssembly.Memory, bytes: number): boolean {
  const page = 65536;
  const need = Math.ceil(Math.max(1, bytes) / page);
  const have = Math.floor(memory.buffer.byteLength / page);
  if (need <= have) return true;
  try {
    memory.grow(need - have);
    return true;
  } catch {
    return false;
  }
}

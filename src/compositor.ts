import { KEY_PARAMS, keyImageData } from "./keying.ts";
import {
  BLUR_COVER_SCALE,
  coverDest,
  jumpOffsetPx,
  mainPanelRect,
  outputSize,
  rectToUvBottomLeft,
  usesBlurBackdrop,
  videoOverlayRect,
  type AspectMode,
} from "./layout.ts";
import type { LoadedPhoto } from "./photos.ts";
import { photoForSlot, slotForTime } from "./timeline.ts";

export { OUTPUT, OUTPUTS, type AspectMode } from "./layout.ts";

/**
 * ImageBitmap を WebGL に直接 texImage2D し、かつ UNPACK_FLIP_Y_WEBGL=1 にすると
 * ブラウザによっては（ImageBitmap が既に GL 向け Y 反転済みのため）写真だけ上下逆になる。
 * 写真は Canvas2D に描いてからキャンバスを上げる。HTMLVideoElement はそのまま FLIP_Y=1。
 */
export const PHOTO_UPLOAD_PATH = "canvas2d-blit" as const;

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, aPos.y * 0.5 + 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uBg;
uniform sampler2D uVideo;
uniform vec4 uVideoRect;
uniform float uHasVideo;
uniform float uTolerance;
uniform float uSoftness;
uniform float uDarkProtect;

vec3 sampleKey(sampler2D tex) {
  vec3 acc = vec3(0.0);
  acc += texture2D(tex, vec2(0.02, 0.015)).rgb;
  acc += texture2D(tex, vec2(0.98, 0.015)).rgb;
  acc += texture2D(tex, vec2(0.50, 0.02)).rgb;
  acc += texture2D(tex, vec2(0.15, 0.06)).rgb;
  acc += texture2D(tex, vec2(0.85, 0.06)).rgb;
  acc += texture2D(tex, vec2(0.02, 0.985)).rgb;
  acc += texture2D(tex, vec2(0.98, 0.985)).rgb;
  return acc / 7.0;
}

void main() {
  vec3 bg = texture2D(uBg, vUv).rgb;
  if (uHasVideo < 0.5) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }
  vec2 rel = (vUv - uVideoRect.xy) / max(uVideoRect.zw, vec2(1e-5));
  if (rel.x < 0.0 || rel.x > 1.0 || rel.y < 0.0 || rel.y > 1.0) {
    gl_FragColor = vec4(bg, 1.0);
    return;
  }
  vec3 key = sampleKey(uVideo);
  vec4 fg = texture2D(uVideo, rel);
  float dist = distance(fg.rgb, key);
  float y = dot(fg.rgb, vec3(0.299, 0.587, 0.114));
  float gscreen = max(0.0, fg.g - max(fg.r, fg.b));
  float alpha = smoothstep(uTolerance, uTolerance + uSoftness, dist);
  float gKill = smoothstep(0.07, 0.22, gscreen);
  alpha = min(alpha, 1.0 - gKill * 0.85);
  if (y < uDarkProtect) {
    alpha = 1.0;
  }
  float spill = 1.0 - smoothstep(uTolerance * 0.4, uTolerance + uSoftness, dist);
  vec3 gray = vec3(y);
  vec3 fgDespill = mix(fg.rgb, gray, spill * 0.7);
  gl_FragColor = vec4(mix(bg, fgDespill, alpha), 1.0);
}
`;

export type Compositor = {
  canvas: HTMLCanvasElement;
  draw: (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => number;
  setAspect: (mode: AspectMode) => void;
  aspect: () => AspectMode;
  destroy: () => void;
  kind: "webgl" | "2d";
};

export function createCompositor(): Compositor {
  let mode: AspectMode = "portrait";
  const size = outputSize(mode);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.className = "stage-canvas";
  canvas.setAttribute("aria-label", "合成プレビュー");
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (gl) {
    try {
      return createWebGlCompositor(canvas, gl, () => mode, (next) => {
        mode = next;
      });
    } catch {
      // fall through
    }
  }
  return createCanvas2dCompositor(canvas, () => mode, (next) => {
    mode = next;
  });
}

function applyCanvasSize(canvas: HTMLCanvasElement, mode: AspectMode): void {
  const size = outputSize(mode);
  canvas.width = size.width;
  canvas.height = size.height;
}

function createBackdrop(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scratch: HTMLCanvasElement;
  scratchCtx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas2D が使えません");
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d", { alpha: false });
  if (!scratchCtx) throw new Error("Canvas2D が使えません");
  return { canvas, ctx, scratch, scratchCtx };
}

function drawBackdrop(
  target: ReturnType<typeof createBackdrop>,
  photo: LoadedPhoto | undefined,
  mode: AspectMode,
  time: number,
  slots: readonly number[],
): HTMLCanvasElement {
  const { canvas, ctx, scratch, scratchCtx } = target;
  applyCanvasSize(canvas, mode);
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.fillStyle = "#F3EDE0";
  ctx.fillRect(0, 0, w, h);
  if (!photo) return canvas;

  const bitmap = photo.bitmap;
  if (!usesBlurBackdrop(mode)) {
    const dest = coverDest(bitmap.width, bitmap.height, w, h);
    ctx.drawImage(bitmap, dest.x, dest.y, dest.w, dest.h);
    return canvas;
  }

  const jumpY = jumpOffsetPx(time, slots, h, mode);
  scratch.width = Math.max(64, Math.round(w * 0.2));
  scratch.height = Math.max(64, Math.round(h * 0.2));
  const sw = scratch.width;
  const sh = scratch.height;
  scratchCtx.fillStyle = "#F3EDE0";
  scratchCtx.fillRect(0, 0, sw, sh);
  const blurDest = coverDest(bitmap.width, bitmap.height, sw, sh, {
    scale: BLUR_COVER_SCALE,
    offsetY: jumpY * (sh / h),
  });
  scratchCtx.drawImage(bitmap, blurDest.x, blurDest.y, blurDest.w, blurDest.h);

  ctx.save();
  ctx.filter = "blur(18px)";
  ctx.drawImage(scratch, -28, -28, w + 56, h + 56);
  ctx.filter = "none";
  ctx.fillStyle = "rgba(16, 12, 10, 0.38)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const panel = mainPanelRect(w, h, mode);
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.clip();
  const sharp = coverDest(bitmap.width, bitmap.height, panel.w, panel.h, {
    dx: panel.x,
    dy: panel.y,
  });
  ctx.drawImage(bitmap, sharp.x, sharp.y, sharp.w, sharp.h);
  ctx.restore();
  return canvas;
}

function createWebGlCompositor(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  getMode: () => AspectMode,
  setMode: (mode: AspectMode) => void,
): Compositor {
  const program = linkProgram(gl, VERT, FRAG);
  const aPos = gl.getAttribLocation(program, "aPos");
  const uniforms = {
    uBg: gl.getUniformLocation(program, "uBg"),
    uVideo: gl.getUniformLocation(program, "uVideo"),
    uVideoRect: gl.getUniformLocation(program, "uVideoRect"),
    uHasVideo: gl.getUniformLocation(program, "uHasVideo"),
    uTolerance: gl.getUniformLocation(program, "uTolerance"),
    uSoftness: gl.getUniformLocation(program, "uSoftness"),
    uDarkProtect: gl.getUniformLocation(program, "uDarkProtect"),
  };
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const bgTex = createTexture(gl);
  const videoTex = createTexture(gl);
  const backdrop = createBackdrop();

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const mode = getMode();
    const slot = slotForTime(video.currentTime, slots);
    const photo = photoForSlot(photos, slot);
    const bg = drawBackdrop(backdrop, photo, mode, video.currentTime, slots);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bg);

    const hasVideo = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, videoTex);
    if (hasVideo) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    const vw = video.videoWidth || outputSize(mode).width;
    const vh = video.videoHeight || outputSize(mode).height;
    const overlay = videoOverlayRect(canvas.width, canvas.height, vw, vh, mode);
    const uv = rectToUvBottomLeft(overlay, canvas.width, canvas.height);

    gl.uniform1i(uniforms.uBg, 0);
    gl.uniform1i(uniforms.uVideo, 1);
    gl.uniform4f(uniforms.uVideoRect, uv[0], uv[1], uv[2], uv[3]);
    gl.uniform1f(uniforms.uHasVideo, hasVideo ? 1 : 0);
    gl.uniform1f(uniforms.uTolerance, KEY_PARAMS.tolerance / 255);
    gl.uniform1f(uniforms.uSoftness, KEY_PARAMS.softness / 255);
    gl.uniform1f(uniforms.uDarkProtect, KEY_PARAMS.darkProtect / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "webgl",
    aspect: getMode,
    setAspect(mode: AspectMode) {
      setMode(mode);
      applyCanvasSize(canvas, mode);
    },
    destroy() {
      gl.deleteTexture(bgTex);
      gl.deleteTexture(videoTex);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      backdrop.canvas.width = 0;
      backdrop.canvas.height = 0;
      backdrop.scratch.width = 0;
      backdrop.scratch.height = 0;
    },
  };
}

function createCanvas2dCompositor(
  canvas: HTMLCanvasElement,
  getMode: () => AspectMode,
  setMode: (mode: AspectMode) => void,
): Compositor {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas2D が使えません");
  }
  const work = document.createElement("canvas");
  const workCtx = work.getContext("2d", { willReadFrequently: true });
  if (!workCtx) {
    throw new Error("Canvas2D が使えません");
  }
  const backdrop = createBackdrop();

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const mode = getMode();
    const slot = slotForTime(video.currentTime, slots);
    const photo = photoForSlot(photos, slot);
    const bg = drawBackdrop(backdrop, photo, mode, video.currentTime, slots);
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const vw = video.videoWidth || outputSize(mode).width;
      const vh = video.videoHeight || outputSize(mode).height;
      work.width = vw;
      work.height = vh;
      workCtx.drawImage(video, 0, 0, vw, vh);
      const image = workCtx.getImageData(0, 0, vw, vh);
      keyImageData(image);
      workCtx.putImageData(image, 0, 0);
      const dest = videoOverlayRect(canvas.width, canvas.height, vw, vh, mode);
      ctx.drawImage(work, dest.x, dest.y, dest.w, dest.h);
    }
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "2d",
    aspect: getMode,
    setAspect(mode: AspectMode) {
      setMode(mode);
      applyCanvasSize(canvas, mode);
    },
    destroy() {
      work.width = 0;
      work.height = 0;
      backdrop.canvas.width = 0;
      backdrop.canvas.height = 0;
    },
  };
}

function createTexture(gl: WebGLRenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("WebGL texture を作れません");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([243, 237, 224, 255]));
  return texture;
}

function linkProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL program を作れません");
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "link failed");
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader を作れません");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "compile failed");
  }
  return shader;
}

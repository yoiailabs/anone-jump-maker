import { KEY_PARAMS, keyImageData } from "./keying.ts";
import { photoForSlot, slotForTime } from "./timeline.ts";
import type { LoadedPhoto } from "./photos.ts";

export const OUTPUT = { width: 720, height: 1280 } as const;

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
uniform sampler2D uPhoto;
uniform sampler2D uVideo;
uniform vec2 uPhotoSize;
uniform vec2 uOutSize;
uniform float uHasPhoto;
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

vec2 coverUv(vec2 uv, vec2 texSize, vec2 outSize) {
  float texAspect = texSize.x / max(texSize.y, 1.0);
  float outAspect = outSize.x / max(outSize.y, 1.0);
  vec2 scale = vec2(1.0);
  if (texAspect > outAspect) {
    scale.x = outAspect / texAspect;
  } else {
    scale.y = texAspect / outAspect;
  }
  return (uv - 0.5) * scale + 0.5;
}

void main() {
  vec3 key = sampleKey(uVideo);
  vec4 fg = texture2D(uVideo, vUv);
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

  vec3 bg = vec3(0.953, 0.929, 0.878);
  if (uHasPhoto > 0.5) {
    vec2 puv = coverUv(vUv, uPhotoSize, uOutSize);
    bg = texture2D(uPhoto, clamp(puv, 0.0, 1.0)).rgb;
  }
  gl_FragColor = vec4(mix(bg, fgDespill, alpha), 1.0);
}
`;

export type Compositor = {
  canvas: HTMLCanvasElement;
  draw: (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => number;
  destroy: () => void;
  kind: "webgl" | "2d";
};

export function createCompositor(): Compositor {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT.width;
  canvas.height = OUTPUT.height;
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
      return createWebGlCompositor(canvas, gl);
    } catch {
      // fall through
    }
  }
  return createCanvas2dCompositor(canvas);
}

function createWebGlCompositor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): Compositor {
  const program = linkProgram(gl, VERT, FRAG);
  const aPos = gl.getAttribLocation(program, "aPos");
  const uniforms = {
    uPhoto: gl.getUniformLocation(program, "uPhoto"),
    uVideo: gl.getUniformLocation(program, "uVideo"),
    uPhotoSize: gl.getUniformLocation(program, "uPhotoSize"),
    uOutSize: gl.getUniformLocation(program, "uOutSize"),
    uHasPhoto: gl.getUniformLocation(program, "uHasPhoto"),
    uTolerance: gl.getUniformLocation(program, "uTolerance"),
    uSoftness: gl.getUniformLocation(program, "uSoftness"),
    uDarkProtect: gl.getUniformLocation(program, "uDarkProtect"),
  };
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const photoTex = createTexture(gl);
  const videoTex = createTexture(gl);
  let lastPhotoId = "";

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const slot = slotForTime(video.currentTime, slots);
    const photo = photoForSlot(photos, slot);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    if (photo && photo.id !== lastPhotoId) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo.bitmap);
      lastPhotoId = photo.id;
    }
    if (!photo) {
      lastPhotoId = "";
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, videoTex);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }

    gl.uniform1i(uniforms.uPhoto, 0);
    gl.uniform1i(uniforms.uVideo, 1);
    gl.uniform2f(uniforms.uPhotoSize, photo?.bitmap.width ?? 1, photo?.bitmap.height ?? 1);
    gl.uniform2f(uniforms.uOutSize, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uHasPhoto, photo ? 1 : 0);
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
    destroy() {
      gl.deleteTexture(photoTex);
      gl.deleteTexture(videoTex);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function createCanvas2dCompositor(canvas: HTMLCanvasElement): Compositor {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas2D が使えません");
  }
  const work = document.createElement("canvas");
  const workCtx = work.getContext("2d", { willReadFrequently: true });
  if (!workCtx) {
    throw new Error("Canvas2D が使えません");
  }

  const draw = (video: HTMLVideoElement, photos: readonly LoadedPhoto[], slots: readonly number[]) => {
    const slot = slotForTime(video.currentTime, slots);
    const photo = photoForSlot(photos, slot);
    const vw = video.videoWidth || OUTPUT.width;
    const vh = video.videoHeight || OUTPUT.height;
    work.width = vw;
    work.height = vh;
    ctx.fillStyle = "#F3EDE0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (photo) {
      drawCover(ctx, photo.bitmap, canvas.width, canvas.height);
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      workCtx.drawImage(video, 0, 0, vw, vh);
      const image = workCtx.getImageData(0, 0, vw, vh);
      keyImageData(image);
      workCtx.putImageData(image, 0, 0);
      ctx.drawImage(work, 0, 0, canvas.width, canvas.height);
    }
    return slot;
  };

  return {
    canvas,
    draw,
    kind: "2d",
    destroy() {
      work.width = 0;
      work.height = 0;
    },
  };
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  dw: number,
  dh: number,
): void {
  const sw = source.width;
  const sh = source.height;
  const scale = Math.max(dw / sw, dh / sh);
  const w = sw * scale;
  const h = sh * scale;
  ctx.drawImage(source, (dw - w) / 2, (dh - h) / 2, w, h);
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

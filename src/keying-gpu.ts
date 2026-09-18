import { ensureCanvasSize } from "./canvas-size.ts";
import {
  KEY_DESPILL_INNER,
  KEY_DESPILL_STRENGTH,
  KEY_GREEN_KILL,
  KEY_PARAMS,
  KEY_SAMPLE_COUNT,
  keySampleUvBottomLeft,
} from "./keying.ts";
import { rectToUvBottomLeft, type Rect } from "./layout.ts";

export type KeyingBackend = "webgl" | "cpu";

export type GpuKeyDebug = {
  context: "webgl2" | "webgl";
  renderer: string;
  vendor: string;
  software: boolean;
};

export type GpuKeyer = {
  canvas: HTMLCanvasElement;
  keyVideoBand: (video: HTMLVideoElement, band: Rect, destW: number, destH: number) => boolean;
  destroy: () => void;
  isLost: () => boolean;
  debug?: GpuKeyDebug;
};

export function isSoftwareWebGLRenderer(renderer: string, vendor = ""): boolean {
  const text = `${renderer} ${vendor}`.toLowerCase();
  return /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mesa offscreen/.test(text);
}

export function pickKeyingBackend(keyer: GpuKeyer | null): KeyingBackend {
  return keyer ? "webgl" : "cpu";
}

/** Keep the GPU keyer only while the current frame uploaded and drew. */
export function shouldUseGpuFrame(keyer: GpuKeyer | null, frameOk: boolean): keyer is GpuKeyer {
  return keyer !== null && frameOk;
}

/** Destroy the GPU keyer only when the context is gone, not on a single missed frame. */
export function shouldDropGpuKeyer(lost: boolean): boolean {
  return lost;
}

export function gpuKeyUniforms(params = KEY_PARAMS) {
  return {
    tolerance: params.tolerance,
    softness: params.softness,
    darkProtect: params.darkProtect,
    greenBoost: params.greenBoost,
    greenSoft: params.greenSoft,
    greenKill: KEY_GREEN_KILL,
    despillInner: KEY_DESPILL_INNER,
    despillStrength: KEY_DESPILL_STRENGTH,
  };
}

export const KEYING_VERTEX_SHADER = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/** GLSL ES 1.00 — same math as `keyAlpha` / `despill` in 0–255 RGB. */
export const KEYING_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 v_uv;
uniform sampler2D u_video;
uniform vec4 u_bandUv;
uniform vec2 u_keyUv[${KEY_SAMPLE_COUNT}];
uniform float u_tolerance;
uniform float u_softness;
uniform float u_darkProtect;
uniform float u_greenBoost;
uniform float u_greenSoft;
uniform float u_greenKill;
uniform float u_despillInner;
uniform float u_despillStrength;

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 key = vec3(0.0);
  for (int i = 0; i < ${KEY_SAMPLE_COUNT}; i++) {
    key += texture2D(u_video, u_keyUv[i]).rgb;
  }
  key *= 1.0 / float(${KEY_SAMPLE_COUNT});

  vec2 texUv = u_bandUv.xy + v_uv * u_bandUv.zw;
  vec3 rgb = texture2D(u_video, texUv).rgb * 255.0;
  vec3 kc = key * 255.0;
  float dist = distance(rgb, kc);
  float alpha = clamp((dist - u_tolerance) / u_softness, 0.0, 1.0);
  float greenScreen = max(0.0, rgb.g - max(rgb.r, rgb.b));
  float greenKill = clamp((greenScreen - u_greenBoost) / u_greenSoft, 0.0, 1.0) * u_greenKill;
  alpha = min(alpha, 1.0 - greenKill);
  if (luma(rgb) < u_darkProtect) {
    alpha = 1.0;
  }
  float spill = 1.0 - clamp((dist - u_tolerance * u_despillInner) / (u_tolerance + u_softness), 0.0, 1.0);
  float t = spill * u_despillStrength;
  float y = luma(rgb);
  vec3 outRgb = rgb + (vec3(y) - rgb) * t;
  gl_FragColor = vec4(outRgb / 255.0, alpha);
}
`;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
  failIfMajorPerformanceCaveat: false,
};

export function createGpuKeyer(): GpuKeyer | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.className = "gpu-keyer";
    const gl = getWebGLContext(canvas);
    if (!gl) return null;

    const debug = readGpuDebug(gl);
    const program = linkProgram(gl, KEYING_VERTEX_SHADER, KEYING_FRAGMENT_SHADER);
    if (!program) return null;

    const aPos = gl.getAttribLocation(program, "a_pos");
    const aUv = gl.getAttribLocation(program, "a_uv");
    const uVideo = gl.getUniformLocation(program, "u_video");
    const uBandUv = gl.getUniformLocation(program, "u_bandUv");
    const uKeyUv = gl.getUniformLocation(program, "u_keyUv[0]");
    const uTolerance = gl.getUniformLocation(program, "u_tolerance");
    const uSoftness = gl.getUniformLocation(program, "u_softness");
    const uDarkProtect = gl.getUniformLocation(program, "u_darkProtect");
    const uGreenBoost = gl.getUniformLocation(program, "u_greenBoost");
    const uGreenSoft = gl.getUniformLocation(program, "u_greenSoft");
    const uGreenKill = gl.getUniformLocation(program, "u_greenKill");
    const uDespillInner = gl.getUniformLocation(program, "u_despillInner");
    const uDespillStrength = gl.getUniformLocation(program, "u_despillStrength");
    if (
      aPos < 0 ||
      aUv < 0 ||
      !uVideo ||
      !uBandUv ||
      !uKeyUv ||
      !uTolerance ||
      !uSoftness ||
      !uDarkProtect ||
      !uGreenBoost ||
      !uGreenSoft ||
      !uGreenKill ||
      !uDespillInner ||
      !uDespillStrength
    ) {
      return null;
    }

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !texture) return null;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    gl.uniform1i(uVideo, 0);
    const uniforms = gpuKeyUniforms();
    gl.uniform1f(uTolerance, uniforms.tolerance);
    gl.uniform1f(uSoftness, uniforms.softness);
    gl.uniform1f(uDarkProtect, uniforms.darkProtect);
    gl.uniform1f(uGreenBoost, uniforms.greenBoost);
    gl.uniform1f(uGreenSoft, uniforms.greenSoft);
    gl.uniform1f(uGreenKill, uniforms.greenKill);
    gl.uniform1f(uDespillInner, uniforms.despillInner);
    gl.uniform1f(uDespillStrength, uniforms.despillStrength);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    let lost = false;
    canvas.addEventListener(
      "webglcontextlost",
      () => {
        lost = true;
      },
      false,
    );

    const isLost = () => lost || gl.isContextLost();

    const keyVideoBand = (video: HTMLVideoElement, band: Rect, destW: number, destH: number): boolean => {
      if (isLost()) {
        lost = true;
        return false;
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!(vw > 0) || !(vh > 0) || destW < 1 || destH < 1) return false;

      const resized = ensureCanvasSize(canvas, destW, destH);
      if (resized) gl.viewport(0, 0, destW, destH);

      try {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } catch {
        return false;
      }

      const bandUv = rectToUvBottomLeft(band, vw, vh);
      gl.useProgram(program);
      gl.uniform4f(uBandUv, bandUv[0], bandUv[1], bandUv[2], bandUv[3]);
      gl.uniform2fv(uKeyUv, keySampleUvBottomLeft(destW, destH, bandUv));

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aUv);
      gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (gl.isContextLost()) {
        lost = true;
        return false;
      }
      return true;
    };

    const destroy = () => {
      lost = true;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.width = 0;
      canvas.height = 0;
    };

    return { canvas, keyVideoBand, destroy, isLost, debug };
  } catch {
    return null;
  }
}

function getWebGLContext(canvas: HTMLCanvasElement): GL | null {
  const names = ["webgl2", "webgl", "experimental-webgl"] as const;
  for (const name of names) {
    const gl = canvas.getContext(name, CONTEXT_ATTRS);
    if (gl) return gl as GL;
  }
  return null;
}

function readGpuDebug(gl: GL): GpuKeyDebug {
  const infoExt = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = infoExt ? String(gl.getParameter(infoExt.UNMASKED_VENDOR_WEBGL) ?? "") : "";
  const renderer = infoExt
    ? String(gl.getParameter(infoExt.UNMASKED_RENDERER_WEBGL) ?? "")
    : String(gl.getParameter(gl.RENDERER) ?? "");
  const isWebgl2 =
    typeof WebGL2RenderingContext === "function" && gl instanceof WebGL2RenderingContext;
  const context: GpuKeyDebug["context"] = isWebgl2 ? "webgl2" : "webgl";
  return {
    context,
    renderer,
    vendor,
    software: isSoftwareWebGLRenderer(renderer, vendor),
  };
}

function linkProgram(gl: GL, vertexSrc: string, fragmentSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(gl: GL, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

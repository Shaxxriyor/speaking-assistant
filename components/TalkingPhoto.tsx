"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarMode } from "./ExaminerAvatar";

/**
 * Normalised [x, y] facial points in the image: scripts/face_landmarks.py (portrait) or
 * scripts/compose_scene.py (examiner seated in the room, which also gives the desk line).
 */
export interface FaceData {
  width: number;
  height: number;
  points: Record<string, [number, number]>;
  /** Room mode: image row of the desk's top edge; she is hidden below it. */
  deskY?: number;
}

export interface Framing {
  /** Point of the image to keep centred, normalised. */
  focus: [number, number];
  /** Zoom beyond "cover" for landscape and portrait boxes. */
  zoomWide: number;
  zoomTall: number;
}

interface Props {
  /** The examiner: a portrait photo, or a room-sized cut-out PNG when `background` is set. */
  src: string;
  /** Room mode: the static room behind her. */
  background?: string;
  face: FaceData;
  alt: string;
  mode: AvatarMode;
  voiceLevel: number;
  framing?: Framing;
  onUnsupported: () => void;
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Warps the examiner's photo in real time (and, in room mode, composites her over the room behind the desk):
//  - jaw/lips open by u_open, revealing a shaded mouth interior with upper teeth
//  - upper eyelids slide down by u_blink: lid skin with a lash line along its edge
//  - the whole head rotates/translates slightly around the neck
const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform sampler2D u_bg;
uniform float u_hasBg;
uniform float u_deskY;
uniform vec2 u_res;
uniform vec2 u_img;
uniform vec4 u_crop;
uniform vec2 u_pivot;
uniform vec3 u_head;
uniform float u_scale;
uniform vec2 u_mc;
uniform vec2 u_mx;
uniform vec4 u_mdim;
uniform float u_open;
uniform vec2 u_mlip;
uniform vec2 u_ec[2];
uniform vec2 u_ex[2];
uniform vec3 u_edim[2];
uniform float u_blink;

vec2 down(vec2 axis) { vec2 n = vec2(-axis.y, axis.x); return n.y < 0.0 ? -n : n; }

void main() {
  vec2 uv = vec2(gl_FragCoord.x / u_res.x, 1.0 - gl_FragCoord.y / u_res.y);
  vec2 p = u_crop.xy + uv * u_crop.zw;
  vec2 room = p;

  // Head motion (inverse transform around the neck pivot).
  vec2 d = p - u_pivot - u_head.xy;
  float c = cos(-u_head.z), s = sin(-u_head.z);
  p = u_pivot + mat2(c, s, -s, c) * d / u_scale;

  // Blinks: the upper lid (skin sampled from just under the brow) slides down, with a lash line on its edge.
  vec3 lidCol = vec3(0.0);
  float lidMask = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 ex = u_ex[i];
    vec2 ey = down(ex);
    vec2 r = vec2(dot(p - u_ec[i], ex), dot(p - u_ec[i], ey));
    float xn = r.x / u_edim[i].x;
    if (u_blink > 0.001 && abs(xn) < 1.0) {
      float pr = sqrt(1.0 - xn * xn);
      float bt = u_edim[i].y;
      float top = -bt * pr;
      float bot = u_edim[i].z * pr;
      float lid = top + u_blink * (bot - top);
      float w = 1.0 - smoothstep(0.75, 1.0, abs(xn));
      float t = clamp((r.y - top) / max(lid - top, 0.5), 0.0, 1.0);
      // Lid skin comes from between the lashes and the brow, blurred sideways so no lash strands show.
      vec2 sp = u_ec[i] + ex * r.x + ey * (-bt * 2.6 + (r.y - top) * 0.12);
      vec3 skin = vec3(0.0);
      for (int k = -3; k <= 3; k++) skin += texture2D(u_tex, clamp((sp + ex * float(k) * 3.0) / u_img, 0.0, 1.0)).rgb;
      skin = skin / 7.0 * mix(1.0, 0.8, t * t);
      float cover = w * smoothstep(top - 1.0, top + 0.5, r.y) * (1.0 - smoothstep(lid - 0.8, lid + 0.8, r.y));
      float lash = w * smoothstep(0.08, 0.3, u_blink) * exp(-pow((r.y - lid) / (1.2 + bt * 0.07), 2.0));
      lidCol = mix(skin, vec3(0.09, 0.06, 0.06), lash / max(cover + lash, 0.001));
      lidMask = max(cover, lash * 0.85);
    }
  }

  // Mouth: lower lip + jaw move down, upper lip lifts slightly.
  vec2 my = down(u_mx);
  vec2 q = vec2(dot(p - u_mc, u_mx), dot(p - u_mc, my));
  float halfW = u_mdim.x, upT = u_mdim.y, loT = u_mdim.z, chinD = u_mdim.w;
  float xn = q.x / halfW;
  // Skew so the deepest point of the lip line (u_mlip.x, where the lips meet) is the centre of the opening;
  // the face is often turned slightly, so it is rarely halfway between the corners.
  float xi = u_mlip.x;
  float uu = xn < xi ? (xn - xi) / (1.0 + xi) : (xn - xi) / (1.0 - xi);
  float prof2 = abs(xn) < 1.0 ? max(0.0, 1.0 - uu * uu) : 0.0;
  float prof = sqrt(prof2);
  float lipLine = u_mlip.y * prof2; // smiles curve: the lips meet below the corner-to-corner line
  q.y -= lipLine;

  float gapMax = u_open * loT * 0.8;
  float lipGap = gapMax * prof;
  float jx = xn - xi;
  float jawGap = gapMax * exp(-jx * jx * 0.35);
  float lift0 = lipGap * 0.22;

  float srcY;
  if (q.y < 0.0) {
    srcY = q.y + lift0 * (1.0 - smoothstep(0.0, upT * 2.5, -q.y));
  } else {
    float g = mix(lipGap, jawGap, smoothstep(0.0, loT * 1.2, q.y));
    float fall = 1.0 - smoothstep(chinD, chinD * 1.9, q.y);
    float lateral = 1.0 - smoothstep(1.5, 2.4, abs(jx));
    srcY = q.y - g * fall * lateral;
  }
  srcY += lipLine;
  vec2 ps = u_mc + u_mx * q.x + my * srcY;
  vec4 person = texture2D(u_tex, clamp(ps / u_img, 0.0, 1.0));
  vec3 col = person.rgb;

  // Mouth interior between the lifted upper lip and the lowered lower lip.
  float inside = smoothstep(-lift0 - 1.0, -lift0 + 1.0, q.y) * (1.0 - smoothstep(lipGap - 1.0, lipGap + 1.0, q.y));
  if (inside > 0.0 && lipGap > 0.3) {
    float t = clamp((q.y + lift0) / (lipGap + lift0), 0.0, 1.0);
    vec3 mouth = mix(vec3(0.34, 0.12, 0.13), vec3(0.07, 0.02, 0.03), smoothstep(0.0, 0.55, t));
    mouth = mix(mouth, vec3(0.30, 0.10, 0.11), smoothstep(0.75, 1.0, t)); // tongue/lower lip shadow
    float teeth = (1.0 - smoothstep(0.12, 0.3, t)) * smoothstep(0.3, 0.7, u_open) * smoothstep(0.2, 0.7, prof);
    mouth = mix(mouth, vec3(0.80, 0.76, 0.72) * (0.6 + 0.3 * prof) * (1.0 - 0.35 * t / 0.3), teeth * 0.85);
    mouth *= 0.55 + 0.45 * prof; // darker toward the corners
    col = mix(col, mouth, inside * smoothstep(0.0, 0.25, prof));
  }
  col = mix(col, lidCol, lidMask);

  if (u_hasBg > 0.5) {
    // She sits behind the desk: the room shows around her and the desk hides her lower body.
    float a = person.a * (1.0 - smoothstep(u_deskY - 0.75, u_deskY + 0.75, room.y));
    col = mix(texture2D(u_bg, room / u_img).rgb, col, a);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

type V2 = [number, number];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const len = (a: V2) => Math.hypot(a[0], a[1]);
const norm = (a: V2): V2 => mul(a, 1 / (len(a) || 1));
const downOf = (axis: V2): V2 => {
  const n: V2 = [-axis[1], axis[0]];
  return n[1] < 0 ? mul(n, -1) : n;
};

function geometry(face: FaceData) {
  const P = (k: string): V2 => {
    const v = face.points[k];
    return [v[0] * face.width, v[1] * face.height];
  };
  // Mouth frame: origin halfway between the corners, x along the corners, y pointing down the face.
  const mc = mul(add(P("mouthLeft"), P("mouthRight")), 0.5);
  const mx = norm(sub(P("mouthRight"), P("mouthLeft")));
  const my = downOf(mx);
  const halfW = len(sub(P("mouthRight"), P("mouthLeft"))) / 2;
  const meet = mul(add(P("upperLipInner"), P("lowerLipInner")), 0.5);
  const lip: V2 = [Math.max(-0.6, Math.min(0.6, dot(sub(meet, mc), mx) / halfW)), dot(sub(meet, mc), my)];
  const upT = Math.max(4, -dot(sub(P("upperLipTop"), meet), my));
  const loT = Math.max(6, dot(sub(P("lowerLipBottom"), meet), my));
  const chinD = Math.max(loT * 2, dot(sub(P("chin"), meet), my));

  const eye = (side: "L" | "R") => {
    const outer = P(`eye${side}Outer`), inner = P(`eye${side}Inner`);
    const top = P(`eye${side}Top`), bottom = P(`eye${side}Bottom`);
    const c = mul(add(add(outer, inner), add(top, bottom)), 0.25);
    const ex = norm(sub(inner, outer));
    const ey = downOf(ex);
    return {
      c,
      ex,
      dim: [(len(sub(inner, outer)) / 2) * 1.18, Math.max(3, -dot(sub(top, c), ey)) * 1.35, Math.max(3, dot(sub(bottom, c), ey))],
    };
  };

  const pivot = add(P("chin"), mul(my, chinD * 0.8));
  return { mc, mx, lip, mdim: [halfW, upT, loT, chinD], eyes: [eye("L"), eye("R")], pivot };
}

// Smooth pseudo-random motion from incommensurate sines.
const wobble = (t: number, seed: number) =>
  (Math.sin(t * 0.83 + seed) + Math.sin(t * 1.37 + seed * 2.1) * 0.6 + Math.sin(t * 0.29 + seed * 3.7) * 0.8) / 2.4;

const PORTRAIT_FRAMING: Framing = { focus: [0.5, 0.45], zoomWide: 1, zoomTall: 1 };

export function TalkingPhoto({ src, background, face, alt, mode, voiceLevel, framing = PORTRAIT_FRAMING, onUnsupported }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(voiceLevel);
  modeRef.current = mode;
  levelRef.current = voiceLevel;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) {
      onUnsupported();
      return;
    }

    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader error");
      return sh;
    };
    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link error");
    } catch (e) {
      console.error("Examiner animation unavailable:", e);
      onUnsupported();
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(program, name);

    const g = geometry(face);
    gl.uniform2f(u("u_img"), face.width, face.height);
    gl.uniform2f(u("u_pivot"), g.pivot[0], g.pivot[1]);
    gl.uniform2f(u("u_mc"), g.mc[0], g.mc[1]);
    gl.uniform2f(u("u_mx"), g.mx[0], g.mx[1]);
    gl.uniform2f(u("u_mlip"), g.lip[0], g.lip[1]);
    gl.uniform4f(u("u_mdim"), g.mdim[0], g.mdim[1], g.mdim[2], g.mdim[3]);
    gl.uniform2fv(u("u_ec"), [...g.eyes[0].c, ...g.eyes[1].c]);
    gl.uniform2fv(u("u_ex"), [...g.eyes[0].ex, ...g.eyes[1].ex]);
    gl.uniform3fv(u("u_edim"), [...g.eyes[0].dim, ...g.eyes[1].dim]);
    const uRes = u("u_res"), uCrop = u("u_crop"), uHead = u("u_head"), uScale = u("u_scale");
    const uOpen = u("u_open"), uBlink = u("u_blink");
    gl.uniform1i(u("u_tex"), 0);
    gl.uniform1i(u("u_bg"), 1);
    gl.uniform1f(u("u_hasBg"), background ? 1 : 0);
    gl.uniform1f(u("u_deskY"), face.deskY ?? face.height);
    const baseScale = background ? 1 : 1.03; // a portrait is zoomed slightly so head motion never shows its edges

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      // Like object-fit: cover, then zoomed and centred on the focus point (clamped to the image).
      const boxAspect = w / h, imgAspect = face.width / face.height;
      const zoom = boxAspect >= 1 ? framing.zoomWide : framing.zoomTall;
      let cw = imgAspect > boxAspect ? face.height * boxAspect : face.width;
      let ch = imgAspect > boxAspect ? face.height : face.width / boxAspect;
      cw /= zoom;
      ch /= zoom;
      const x0 = Math.min(face.width - cw, Math.max(0, framing.focus[0] * face.width - cw / 2));
      const y0 = Math.min(face.height - ch, Math.max(0, framing.focus[1] * face.height - ch / 2));
      gl.uniform4f(uCrop, x0, y0, cw, ch);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loadTexture = (url: string, unit: number) =>
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          if (disposed) return;
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });

    let raf = 0;
    let disposed = false;
    Promise.all([loadTexture(src, 0), background ? loadTexture(background, 1) : Promise.resolve()]).then(() => {
      if (disposed) return;
      resize();
      setReady(true);
      raf = requestAnimationFrame(frame);
    }, onUnsupported);

    // Animation state.
    let open = 0, speechEnv = 0;
    let nextBlink = performance.now() + 1500, blinkStart = -1, doubleBlink = false;
    let nextNod = performance.now() + 4000, nodStart = -1;
    const start = performance.now();
    const override = () =>
      process.env.NODE_ENV !== "production"
        ? (window as unknown as { __examinerOverride?: { open?: number; blink?: number } }).__examinerOverride
        : undefined;

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const m = modeRef.current;
      const speaking = m === "speaking";

      // Lips follow the voice envelope: fast attack, slower release, like a real jaw.
      const target = speaking ? Math.min(1, Math.max(0, (levelRef.current - 0.06) * 1.7)) ** 0.85 : 0;
      open += (target - open) * (target > open ? 0.55 : 0.28);
      speechEnv += ((speaking ? levelRef.current : 0) - speechEnv) * 0.04;

      // Natural blinks every 2–6 s, sometimes a double blink.
      if (blinkStart < 0 && now >= nextBlink) {
        blinkStart = now;
        doubleBlink = Math.random() < 0.15;
      }
      let blink = 0;
      if (blinkStart >= 0) {
        const k = (now - blinkStart) / 260;
        if (k >= 1) {
          blinkStart = doubleBlink ? now + 90 : -1;
          doubleBlink = false;
          if (blinkStart < 0) nextBlink = now + 2000 + Math.random() * 4000;
        } else if (k >= 0) {
          blink = k < 0.4 ? Math.sin((k / 0.4) * Math.PI / 2) : Math.cos(((k - 0.4) / 0.6) * Math.PI / 2);
        }
      }

      // Small acknowledging nods while the student talks.
      let nod = 0;
      if (m === "listening") {
        if (nodStart < 0 && now >= nextNod) nodStart = now;
        if (nodStart >= 0) {
          const k = (now - nodStart) / 900;
          if (k >= 1) {
            nodStart = -1;
            nextNod = now + 4500 + Math.random() * 4000;
          } else nod = Math.sin(k * Math.PI);
        }
      } else {
        nodStart = -1;
        nextNod = now + 3000;
      }

      const breath = Math.sin((t * 2 * Math.PI) / 5.5);
      const tx = wobble(t * 0.35, 1.3) * 3 + (speaking ? wobble(t * 1.1, 4.2) * 2 * speechEnv : 0);
      const ty = wobble(t * 0.3, 2.7) * 2 - breath * 1.2 + nod * 5 + (speaking ? Math.sin(t * 2.4) * 3 * speechEnv : 0);
      const rot = wobble(t * 0.25, 5.1) * 0.006 + (speaking ? wobble(t * 0.9, 7.3) * 0.008 * speechEnv : 0) + nod * 0.004;

      const o = override();
      gl.uniform3f(uHead, tx, ty, rot);
      gl.uniform1f(uScale, baseScale + breath * 0.004);
      gl.uniform1f(uOpen, o?.open ?? open);
      gl.uniform1f(uBlink, o?.blink ?? blink);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [src, background, face, framing, onUnsupported]);

  return (
    <canvas
      ref={canvasRef}
      className="avatar__media"
      role="img"
      aria-label={alt}
      style={{ opacity: ready ? 1 : 0, transition: "opacity .3s" }}
    />
  );
}

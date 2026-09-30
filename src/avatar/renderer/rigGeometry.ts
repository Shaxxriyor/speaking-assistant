import type { AvatarRig, RigPoint } from "@/types/rig";

export type V2 = [number, number];
const sub = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const len = (a: V2) => Math.hypot(a[0], a[1]);
const norm = (a: V2): V2 => mul(a, 1 / (len(a) || 1));
/** Perpendicular to `axis`, pointing down the picture. */
export const downOf = (axis: V2): V2 => {
  const n: V2 = [-axis[1], axis[0]];
  return n[1] < 0 ? mul(n, -1) : n;
};

/** Measurements the photo-rig shader needs, derived once from the rig's landmarks. */
export function rigGeometry(rig: AvatarRig) {
  const P = (k: RigPoint): V2 => rig.points[k];

  const faceWidth = len(sub(P("jawRight"), P("jawLeft")));

  // Mouth frame: origin between the corners, x along the corners, y down the face.
  const mc = mul(add(P("mouthLeft"), P("mouthRight")), 0.5);
  const mx = norm(sub(P("mouthRight"), P("mouthLeft")));
  const my = downOf(mx);
  const halfW = len(sub(P("mouthRight"), P("mouthLeft"))) / 2;
  const meet = mul(add(P("upperLipInner"), P("lowerLipInner")), 0.5);
  const lip: V2 = [Math.max(-0.6, Math.min(0.6, dot(sub(meet, mc), mx) / halfW)), dot(sub(meet, mc), my)];
  const upT = Math.max(2, -dot(sub(P("upperLipTop"), meet), my));
  const loT = Math.max(3, dot(sub(P("lowerLipBottom"), meet), my));
  const chinD = Math.max(loT * 2, dot(sub(P("chin"), meet), my));

  const eye = (s: "L" | "R") => {
    const outer = P(`eye${s}Outer`), inner = P(`eye${s}Inner`), top = P(`eye${s}Top`), bottom = P(`eye${s}Bottom`);
    const c = mul(add(add(outer, inner), add(top, bottom)), 0.25);
    const ex = norm(sub(inner, outer));
    const ey = downOf(ex);
    const halfWidth = (len(sub(inner, outer)) / 2) * 1.18;
    const topD = Math.max(2, -dot(sub(top, c), ey));
    const botD = Math.max(2, dot(sub(bottom, c), ey));
    const browD = Math.max(4, -dot(sub(P(`brow${s}Mid`), c), ey));
    const iris = sub(P(`iris${s}`), c);
    return {
      c,
      ex,
      dim: [halfWidth, topD * 1.35, botD, browD] as [number, number, number, number],
      iris: [dot(iris, ex), dot(iris, ey)] as V2,
      irisR: Math.max(2, (len(sub(inner, outer)) / 2) * 0.42),
      topPoint: top,
    };
  };

  const brow = (s: "L" | "R", eyeTop: V2) => {
    const inner = P(`brow${s}Inner`), outer = P(`brow${s}Outer`), mid = P(`brow${s}Mid`);
    const bx = norm(sub(outer, inner));
    const by = downOf(bx);
    const c = mid;
    const toInner = Math.sign(dot(sub(inner, c), bx)) || -1;
    return {
      c,
      bx,
      dim: [len(sub(outer, inner)) / 2, Math.max(4, dot(sub(eyeTop, c), by)), toInner] as [number, number, number],
      length: len(sub(outer, inner)),
    };
  };

  const eyeL = eye("L");
  const eyeR = eye("R");
  const eyesMid = mul(add(eyeL.c, eyeR.c), 0.5);
  const headC = mul(add(eyesMid, P("chin")), 0.5);
  const pivot = add(P("chin"), mul(my, chinD * 0.8));

  const wrist = P("wrist");
  const handC = mul(add(wrist, P("penTip")), 0.5);
  const handR = Math.max(len(sub(P("penTop"), handC)), len(sub(P("penTip"), handC))) * 1.1;

  return {
    faceWidth,
    mouth: { mc, mx, lip, dim: [halfW, upT, loT, chinD] as [number, number, number, number] },
    eyes: [eyeL, eyeR],
    brows: [brow("L", eyeL.topPoint), brow("R", eyeR.topPoint)],
    head: { c: headC, r: faceWidth * 1.05, pivot },
    hand: { c: handC, r: handR, wrist },
    torso: rig.torso,
    deskY: rig.deskY,
  };
}

export type RigGeometry = ReturnType<typeof rigGeometry>;

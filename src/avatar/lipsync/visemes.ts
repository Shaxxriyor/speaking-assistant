/** Simplified mouth shapes per letter: how open the jaw/lips are and how spread (+) or rounded (-) the lips are. */
export interface MouthShape {
  open: number;
  wide: number;
}

const SHAPES: Record<string, MouthShape> = {
  a: { open: 0.75, wide: 0.2 },
  e: { open: 0.5, wide: 0.5 },
  i: { open: 0.35, wide: 0.7 },
  y: { open: 0.35, wide: 0.6 },
  o: { open: 0.6, wide: -0.6 },
  u: { open: 0.3, wide: -0.8 },
  w: { open: 0.2, wide: -0.8 },
  m: { open: 0, wide: 0 },
  b: { open: 0, wide: 0 },
  p: { open: 0, wide: 0 },
  f: { open: 0.12, wide: 0.2 },
  v: { open: 0.12, wide: 0.2 },
};
const CONSONANT: MouthShape = { open: 0.22, wide: 0.1 };
const REST: MouthShape = { open: 0, wide: 0 };

export function shapeFor(ch: string): MouthShape {
  const c = ch.toLowerCase();
  if (SHAPES[c]) return SHAPES[c];
  return /[a-z]/.test(c) ? CONSONANT : REST;
}

/** Extra silence after punctuation, in seconds. */
export function pauseAfter(ch: string): number {
  if (ch === ",") return 0.18;
  if (ch === ";" || ch === ":") return 0.25;
  if (ch === "." || ch === "?" || ch === "!") return 0.35;
  return 0;
}

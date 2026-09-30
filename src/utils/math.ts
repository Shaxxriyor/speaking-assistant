export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential approach of `current` toward `target` with time constant `tau` seconds. */
export const damp = (current: number, target: number, tau: number, dt: number) =>
  tau <= 0 ? target : lerp(current, target, 1 - Math.exp(-dt / tau));

/** Smooth 0 → 1 → 0 bump over t ∈ [0, 1]. */
export const bell = (t: number) => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t) ** 2);

export const randRange = (random: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * random();

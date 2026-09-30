/** Smooth, non-repeating-looking 1D noise in roughly [-1, 1], built from incommensurate sines. Deterministic per seed. */
export const noise1 = (t: number, seed = 0) =>
  (Math.sin(t * 0.83 + seed) + Math.sin(t * 1.37 + seed * 2.1) * 0.6 + Math.sin(t * 0.29 + seed * 3.7) * 0.8) / 2.4;

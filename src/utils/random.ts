/** Small seedable PRNG (mulberry32) so animation behaviour is reproducible in tests. */
export function createRandom(seed = Date.now()): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T>(items: readonly { value: T; weight: number }[], random: () => number): T | undefined {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items.at(-1)?.value;
}

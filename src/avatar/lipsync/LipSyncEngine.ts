import { damp } from "@/utils/math";
import { pauseAfter, shapeFor, type MouthShape } from "./visemes";

export interface LipSyncOutput {
  open: number;
  wide: number;
  /** Slow speech energy (0 … 1) for head and brow emphasis. */
  energy: number;
  active: boolean;
}

interface TimelineEntry {
  at: number;
  shape: MouthShape;
}

const LEVEL_TIMEOUT = 0.15;

/**
 * Drives the mouth while the examiner speaks, from two possible sources:
 * - text: a letter-by-letter mouth-shape timeline, re-synchronised by word boundary events from the voice
 * - level: live audio amplitude (when the voice is an audio stream we can analyse)
 * Amplitude wins while it is arriving; the text timeline still supplies lip rounding/spreading.
 */
export class LipSyncEngine {
  private timeline: TimelineEntry[] = [];
  private charTimes: number[] = [];
  private cursor = 0;
  private speaking = false;
  private level = 0;
  private sinceLevel = Infinity;
  private out: LipSyncOutput = { open: 0, wide: 0, energy: 0, active: false };

  constructor(private readonly charsPerSecond = 13.5) {}

  /** Start speaking `text`. */
  begin(text: string) {
    this.timeline = [];
    this.charTimes = [];
    let t = 0;
    const step = 1 / this.charsPerSecond;
    for (const ch of text) {
      this.charTimes.push(t);
      this.timeline.push({ at: t, shape: shapeFor(ch) });
      t += step + pauseAfter(ch);
    }
    this.timeline.push({ at: t, shape: { open: 0, wide: 0 } });
    this.cursor = 0;
    this.speaking = true;
  }

  /** The voice reports it reached character `charIndex`: jump the timeline there if we drifted. */
  boundary(charIndex: number) {
    const at = this.charTimes[charIndex];
    if (at !== undefined && Math.abs(at - this.cursor) > 0.08) this.cursor = at;
  }

  /** Live amplitude 0 … 1 from an audio analyser. */
  pushLevel(level: number) {
    this.level = level;
    this.sinceLevel = 0;
  }

  end() {
    this.speaking = false;
  }

  get isSpeaking() {
    return this.speaking;
  }

  private shapeAt(t: number): MouthShape {
    const tl = this.timeline;
    if (!tl.length || t >= tl[tl.length - 1].at) return { open: 0, wide: 0 };
    let lo = 0;
    let hi = tl.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (tl[mid].at <= t) lo = mid;
      else hi = mid - 1;
    }
    return tl[lo].shape;
  }

  update(dt: number): LipSyncOutput {
    this.sinceLevel += dt;
    let target: MouthShape = { open: 0, wide: 0 };
    if (this.speaking) {
      this.cursor += dt;
      target = this.shapeAt(this.cursor);
      if (this.sinceLevel < LEVEL_TIMEOUT) target = { open: Math.min(1, Math.max(0, (this.level - 0.06) * 1.7)), wide: target.wide };
    }
    const o = this.out;
    // Jaw opens faster than it closes; lip shape changes a little slower.
    o.open = damp(o.open, target.open * 0.85, target.open > o.open ? 0.035 : 0.06, dt);
    o.wide = damp(o.wide, target.wide, 0.08, dt);
    o.energy = damp(o.energy, this.speaking ? o.open : 0, 0.4, dt);
    o.active = this.speaking;
    return o;
  }

  get output(): LipSyncOutput {
    return this.out;
  }
}

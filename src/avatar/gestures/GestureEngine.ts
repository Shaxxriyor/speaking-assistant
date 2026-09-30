import type { GestureName } from "@/types/avatar";
import { randRange } from "@/utils/math";
import type { StateBehavior } from "../state/behaviors";
import { GESTURES, type GestureChannel } from "./gestures";

interface ActiveGesture {
  name: GestureName;
  start: number;
}

/**
 * Plays short gestures (nods, brow flashes, pen taps, …) and exposes their summed effect per channel.
 * Controllers read channels with `sample()`; they never need to know which gesture is playing.
 */
export class GestureEngine {
  private active: ActiveGesture[] = [];
  private nextAuto = new Map<GestureName, number>();
  private now = 0;

  constructor(private readonly random: () => number) {}

  trigger(name: GestureName, at = this.now) {
    // Restarting a gesture that is already playing looks more natural than stacking it.
    this.active = this.active.filter((g) => g.name !== name);
    this.active.push({ name, start: at });
  }

  isPlaying(name: GestureName) {
    return this.active.some((g) => g.name === name);
  }

  /** Reset the automatic gesture timers, e.g. when the examiner state changes. */
  resetAuto() {
    this.nextAuto.clear();
  }

  /** Advance time (seconds) and start automatic gestures that are due for this behaviour. */
  update(time: number, behavior: StateBehavior) {
    this.now = time;
    this.active = this.active.filter((g) => (time - g.start) * 1000 < GESTURES[g.name].durationMs);
    for (const auto of behavior.autoGestures) {
      const due = this.nextAuto.get(auto.gesture);
      if (due === undefined) {
        this.nextAuto.set(auto.gesture, time + randRange(this.random, auto.everyMs) / 1000);
      } else if (time >= due) {
        this.trigger(auto.gesture, time);
        this.nextAuto.set(auto.gesture, time + randRange(this.random, auto.everyMs) / 1000);
      }
    }
  }

  sample(channel: GestureChannel): number {
    let sum = 0;
    for (const g of this.active) {
      const def = GESTURES[g.name];
      const curve = def.channels[channel];
      if (!curve) continue;
      const t = ((this.now - g.start) * 1000) / def.durationMs;
      if (t >= 0 && t <= 1) sum += curve(t);
    }
    return sum;
  }
}

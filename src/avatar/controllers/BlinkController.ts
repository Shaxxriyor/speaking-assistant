import type { AvatarEvent, AvatarPose } from "@/types/avatar";
import { randRange } from "@/utils/math";
import type { AnimationContext, AnimationController } from "./AnimationController";

const CLOSE = 0.09;
const OPEN = 0.17;

/** Spontaneous blinks (interval depends on state), occasional double blinks, blinks with big gaze shifts. */
export class BlinkController implements AnimationController {
  readonly name = "blink";
  private start = -1;
  private next = 1.5;
  private queued = 0;

  handle(event: AvatarEvent, ctx: AnimationContext) {
    if (event.type === "blink") this.begin(ctx.time);
  }

  private begin(time: number) {
    if (this.start < 0) this.start = time;
  }

  /** Current blink closure 0 … 1 (exposed for tests and the dev panel). */
  amount(time: number) {
    if (this.start < 0) return 0;
    const t = time - this.start;
    if (t < 0) return 0;
    if (t < CLOSE) return Math.sin((t / CLOSE) * (Math.PI / 2));
    if (t < CLOSE + OPEN) return Math.cos(((t - CLOSE) / OPEN) * (Math.PI / 2));
    return 0;
  }

  update(ctx: AnimationContext, pose: AvatarPose) {
    const { time, random } = ctx;
    if (this.start >= 0 && time - this.start >= CLOSE + OPEN) {
      this.start = -1;
      if (this.queued > 0) {
        this.queued--;
        this.start = time + 0.08;
      } else {
        this.next = time + randRange(random, ctx.behavior.blinkIntervalMs) / 1000;
      }
    }
    if (this.start < 0) {
      const gazeBlink = ctx.signals.saccade > 0.5 && random() < 0.45;
      if (time >= this.next || gazeBlink) {
        this.begin(time);
        if (random() < 0.12) this.queued = 1;
      }
    }
    const b = this.amount(time);
    pose.lids.left = Math.max(pose.lids.left, b);
    pose.lids.right = Math.max(pose.lids.right, b);
  }
}

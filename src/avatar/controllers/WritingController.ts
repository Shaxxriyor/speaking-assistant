import type { AvatarEvent, AvatarPose } from "@/types/avatar";
import { damp } from "@/utils/math";
import type { AnimationContext, AnimationController } from "./AnimationController";

/**
 * Handwriting: short strokes that travel to the right in "words", with small loops, pen lifts between words,
 * and a carriage return. Active in the WRITING state or when forced by a `writing` event.
 */
export class WritingController implements AnimationController {
  readonly name = "writing";
  private forced: boolean | null = null;
  private weight = 0;
  private lineX = 0;
  private wordEnd = 0;
  private pauseUntil = 0;

  handle(event: AvatarEvent) {
    if (event.type === "writing") this.forced = event.active;
  }

  get isWriting() {
    return this.weight > 0.5;
  }

  update(ctx: AnimationContext, pose: AvatarPose) {
    const { time, dt, random } = ctx;
    const active = this.forced ?? ctx.behavior.writing;
    this.weight = damp(this.weight, active ? 1 : 0, 0.25, dt);
    if (this.weight < 0.01) return;

    let lift = 0;
    if (time < this.pauseUntil) {
      lift = 1;
    } else {
      this.lineX += dt * 0.55;
      if (this.lineX >= this.wordEnd) {
        this.pauseUntil = time + 0.12 + random() * 0.25;
        this.wordEnd = this.lineX + 0.15 + random() * 0.25;
        if (this.lineX > 1.2) {
          this.lineX = 0;
          this.wordEnd = 0.2 + random() * 0.2;
          this.pauseUntil = time + 0.4;
        }
      }
    }
    // Letters: small fast loops on top of the rightward travel.
    const loopX = 0.08 * Math.sin(time * 26);
    const loopY = 0.12 * Math.sin(time * 19 + 0.7);
    const w = this.weight;
    pose.hand.x += w * (this.lineX - 0.6 + loopX * (1 - lift));
    pose.hand.y += w * (loopY * (1 - lift) - 0.08 * lift);
    pose.hand.penLift = Math.max(pose.hand.penLift, w * lift * 0.7);
  }
}

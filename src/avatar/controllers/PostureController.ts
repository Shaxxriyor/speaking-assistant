import type { AvatarPose } from "@/types/avatar";
import { damp } from "@/utils/math";
import { noise1 } from "@/utils/noise";
import type { AnimationContext, AnimationController } from "./AnimationController";

/** Breathing, forward lean that follows the state (leaning in to listen), and slow posture drift. */
export class PostureController implements AnimationController {
  readonly name = "posture";
  private lean = 0;

  update(ctx: AnimationContext, pose: AvatarPose) {
    // ~14 breaths per minute, slightly irregular.
    const breathRate = 0.23 + 0.02 * noise1(ctx.time * 0.1, 11);
    pose.torso.breath = Math.sin(ctx.time * 2 * Math.PI * breathRate);
    this.lean = damp(this.lean, ctx.behavior.lean, 1.2, ctx.dt);
    pose.torso.lean = this.lean + ctx.gestures.sample("torsoLean");
    pose.torso.shift = 0.25 * ctx.behavior.activity * noise1(ctx.time * 0.07, 3) + ctx.gestures.sample("torsoShift");
  }
}

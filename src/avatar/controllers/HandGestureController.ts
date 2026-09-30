import type { AvatarPose } from "@/types/avatar";
import { noise1 } from "@/utils/noise";
import type { AnimationContext, AnimationController } from "./AnimationController";

/** Writing-hand gestures (pen taps, lifting the hand while talking) and the tiny tremor of a resting hand. */
export class HandGestureController implements AnimationController {
  readonly name = "hands";

  update(ctx: AnimationContext, pose: AvatarPose) {
    const { gestures, time } = ctx;
    pose.hand.x += gestures.sample("handX") + 0.03 * noise1(time * 0.6, 31);
    pose.hand.y += gestures.sample("handY") + 0.03 * noise1(time * 0.5, 33);
    pose.hand.penLift = Math.max(pose.hand.penLift, gestures.sample("penLift"));
  }
}

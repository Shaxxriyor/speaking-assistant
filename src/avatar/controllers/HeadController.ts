import type { AvatarPose } from "@/types/avatar";
import { damp } from "@/utils/math";
import { noise1 } from "@/utils/noise";
import { HEAD_FOLLOW } from "../gaze/targets";
import type { AnimationContext, AnimationController } from "./AnimationController";

/**
 * Head orientation: follows the gaze partially and with lag (eyes lead, head follows), idles with slow drift,
 * moves with speech rhythm while talking, and plays nods/tilts from the gesture engine. Runs after GazeController.
 */
export class HeadController implements AnimationController {
  readonly name = "head";
  private yaw = 0;
  private pitch = 0;

  update(ctx: AnimationContext, pose: AvatarPose) {
    const { time, dt, behavior, gestures, lipSync } = ctx;
    this.yaw = damp(this.yaw, pose.gaze.x * HEAD_FOLLOW.x, 0.35, dt);
    this.pitch = damp(this.pitch, pose.gaze.y * HEAD_FOLLOW.y, 0.35, dt);

    const a = behavior.activity;
    const speech = lipSync.energy;
    pose.head.yaw = this.yaw + 0.06 * a * noise1(time * 0.35, 1) + 0.05 * speech * noise1(time * 1.1, 4) + gestures.sample("headYaw");
    pose.head.pitch = this.pitch + 0.04 * a * noise1(time * 0.3, 2) + 0.06 * speech * Math.sin(time * 2.4) + gestures.sample("headPitch");
    pose.head.roll = 0.008 * a * noise1(time * 0.25, 5) + 0.006 * speech * noise1(time * 0.9, 7) + gestures.sample("headRoll");
    pose.head.x = 0.01 * a * noise1(time * 0.2, 8);
    pose.head.y = 0.006 * pose.torso.breath;
  }
}

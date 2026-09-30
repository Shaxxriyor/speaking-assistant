import type { AvatarPose } from "@/types/avatar";
import type { AnimationContext, AnimationController } from "./AnimationController";

/** Mouth shape from the lip-sync engine, plus the small brow lifts people make on stressed syllables. */
export class LipSyncController implements AnimationController {
  readonly name = "lipsync";

  update(ctx: AnimationContext, pose: AvatarPose) {
    const { open, wide, energy } = ctx.lipSync;
    pose.mouth.open = open;
    pose.mouth.wide = wide * 0.6;
    // Speaking narrows the resting smile a little (lips are busy) and adds emphasis on loud syllables.
    pose.mouth.smile -= 0.12 * energy;
    pose.brows.raise += 0.25 * Math.max(0, open - 0.55);
  }
}

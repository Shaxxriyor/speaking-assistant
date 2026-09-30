import type { AvatarPose } from "@/types/avatar";
import { damp } from "@/utils/math";
import { EXPRESSIONS } from "../facial/expressions";
import type { AnimationContext, AnimationController } from "./AnimationController";

/** Resting eyelid position: lids follow the eyes down when she looks at her papers, and narrow slightly with smiles. */
export class EyeController implements AnimationController {
  readonly name = "eyes";
  private lid = 0;

  update(ctx: AnimationContext, pose: AvatarPose) {
    const lookDown = Math.max(0, pose.gaze.y) * 0.42;
    const squint = EXPRESSIONS[ctx.behavior.expression].squint;
    this.lid = damp(this.lid, lookDown + squint, 0.06, ctx.dt);
    pose.lids.left = this.lid;
    pose.lids.right = this.lid;
  }
}

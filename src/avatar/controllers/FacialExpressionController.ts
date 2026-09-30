import type { AvatarEvent, AvatarPose, ExpressionName } from "@/types/avatar";
import { damp } from "@/utils/math";
import { noise1 } from "@/utils/noise";
import { EXPRESSIONS } from "../facial/expressions";
import type { AnimationContext, AnimationController } from "./AnimationController";

/** Blends brows and smile toward the current expression (state default or an explicit override). */
export class FacialExpressionController implements AnimationController {
  readonly name = "expression";
  private browRaise = 0;
  private browFurrow = 0;
  private smile = 0;
  private override: { expression: ExpressionName; until: number } | null = null;

  handle(event: AvatarEvent, ctx: AnimationContext) {
    if (event.type === "expression") this.override = { expression: event.expression, until: ctx.time + (event.holdMs ?? 3000) / 1000 };
  }

  update(ctx: AnimationContext, pose: AvatarPose) {
    if (this.override && ctx.time >= this.override.until) this.override = null;
    const shape = EXPRESSIONS[this.override?.expression ?? ctx.behavior.expression];
    // Expressions change over a few hundred ms; tiny noise keeps the face from looking frozen.
    this.browRaise = damp(this.browRaise, shape.browRaise, 0.3, ctx.dt);
    this.browFurrow = damp(this.browFurrow, shape.browFurrow, 0.35, ctx.dt);
    this.smile = damp(this.smile, shape.smile, 0.4, ctx.dt);
    pose.brows.raise = this.browRaise + 0.03 * noise1(ctx.time * 0.5, 21) + ctx.gestures.sample("browRaise");
    pose.brows.furrow = this.browFurrow;
    pose.mouth.smile = this.smile + 0.03 * noise1(ctx.time * 0.3, 23) + ctx.gestures.sample("smile");
  }
}

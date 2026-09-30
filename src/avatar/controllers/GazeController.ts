import type { AvatarEvent, AvatarPose, GazeTargetName, Vec2 } from "@/types/avatar";
import { damp, randRange } from "@/utils/math";
import { pickWeighted } from "@/utils/random";
import { GAZE_TARGETS } from "../gaze/targets";
import type { AnimationContext, AnimationController } from "./AnimationController";

/**
 * Where her eyes point. Eyes move in quick saccades between fixations (not smooth sweeps), with tiny
 * fixational micro-saccades, occasional glances (e.g. at her notes) and explicit lookAt overrides.
 */
export class GazeController implements AnimationController {
  readonly name = "gaze";
  private current: Vec2 = { x: 0, y: 0 };
  private fixation: Vec2 = { x: 0, y: 0 };
  private micro: Vec2 = { x: 0, y: 0 };
  private nextMicro = 0;
  private override: { target: Vec2; until: number } | null = null;
  private glance: { target: Vec2; until: number } | null = null;
  private nextGlance = 0;

  get target(): Vec2 {
    return this.fixation;
  }

  handle(event: AvatarEvent, ctx: AnimationContext) {
    if (event.type !== "lookAt") return;
    const target = typeof event.target === "string" ? GAZE_TARGETS[event.target] : event.target;
    this.override = { target, until: ctx.time + (event.holdMs ?? 2500) / 1000 };
  }

  onStateChange(ctx: AnimationContext) {
    this.glance = null;
    this.nextGlance = ctx.time + randRange(ctx.random, ctx.behavior.glanceEveryMs) / 1000;
  }

  private chooseTarget(ctx: AnimationContext): Vec2 {
    const { time, behavior, random } = ctx;
    if (this.override && time < this.override.until) return this.override.target;
    this.override = null;
    if (this.glance && time >= this.glance.until) this.glance = null;
    if (!this.glance && behavior.glances.length && time >= this.nextGlance) {
      const name = pickWeighted<GazeTargetName>(behavior.glances, random);
      if (name) this.glance = { target: GAZE_TARGETS[name], until: time + randRange(random, behavior.glanceHoldMs) / 1000 };
      this.nextGlance = time + randRange(random, behavior.glanceEveryMs) / 1000;
    }
    return this.glance?.target ?? GAZE_TARGETS[behavior.gaze];
  }

  update(ctx: AnimationContext, pose: AvatarPose) {
    const target = this.chooseTarget(ctx);
    const jump = Math.hypot(target.x - this.fixation.x, target.y - this.fixation.y);
    if (jump > 0.01) {
      ctx.signals.saccade = jump;
      this.fixation = { ...target };
    }
    // Micro-saccades every 0.4–1.8 s while fixating.
    if (ctx.time >= this.nextMicro) {
      const r = 0.035;
      this.micro = { x: (ctx.random() * 2 - 1) * r, y: (ctx.random() * 2 - 1) * r * 0.6 };
      this.nextMicro = ctx.time + 0.4 + ctx.random() * 1.4;
    }
    const gy = ctx.gestures.sample("gazeY");
    // Saccades take ~40–60 ms: a very short time constant.
    this.current.x = damp(this.current.x, this.fixation.x + this.micro.x, 0.03, ctx.dt);
    this.current.y = damp(this.current.y, this.fixation.y + this.micro.y + gy, 0.03, ctx.dt);
    pose.gaze.x = this.current.x;
    pose.gaze.y = this.current.y;
  }
}

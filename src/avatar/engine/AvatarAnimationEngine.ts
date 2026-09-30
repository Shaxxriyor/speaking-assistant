import { ExaminerState, neutralPose, type AvatarEvent, type AvatarPose, type PoseOverrides } from "@/types/avatar";
import { clamp } from "@/utils/math";
import { createRandom } from "@/utils/random";
import type { AnimationContext, AnimationController, FrameSignals } from "../controllers/AnimationController";
import { BlinkController } from "../controllers/BlinkController";
import { EyeController } from "../controllers/EyeController";
import { FacialExpressionController } from "../controllers/FacialExpressionController";
import { GazeController } from "../controllers/GazeController";
import { HandGestureController } from "../controllers/HandGestureController";
import { HeadController } from "../controllers/HeadController";
import { LipSyncController } from "../controllers/LipSyncController";
import { PostureController } from "../controllers/PostureController";
import { WritingController } from "../controllers/WritingController";
import { GestureEngine } from "../gestures/GestureEngine";
import { LipSyncEngine } from "../lipsync/LipSyncEngine";
import type { AvatarRenderer } from "../renderer/AvatarRenderer";
import { STATE_BEHAVIORS } from "../state/behaviors";

export interface EngineSnapshot {
  state: ExaminerState;
  pose: AvatarPose;
  fps: number;
}

export interface AvatarAnimationEngineOptions {
  random?: () => number;
  /** Replace the default controller set (e.g. to test one controller in isolation). */
  controllers?: AnimationController[];
}

/** Default controllers in evaluation order: later controllers may read what earlier ones wrote. */
export function defaultControllers(): AnimationController[] {
  return [
    new PostureController(),
    new GazeController(),
    new HeadController(),
    new EyeController(),
    new BlinkController(),
    new FacialExpressionController(),
    new LipSyncController(),
    new HandGestureController(),
    new WritingController(),
  ];
}

/**
 * Runs the examiner's animation: each frame it builds a neutral pose, lets every controller contribute, applies
 * developer overrides and hands the pose to the renderer. Framework-free; `step()` can be driven manually in tests.
 */
export class AvatarAnimationEngine {
  readonly lipSync = new LipSyncEngine();
  readonly gestures: GestureEngine;
  readonly controllers: AnimationController[];

  private readonly random: () => number;
  private renderer: AvatarRenderer | null = null;
  private state = ExaminerState.IDLE;
  private stateStart = 0;
  private time = 0;
  private overrides: PoseOverrides = {};
  private pose = neutralPose();
  private signals: FrameSignals = { saccade: 0 };
  private listeners = new Set<(snap: EngineSnapshot) => void>();
  private raf = 0;
  private lastFrame = 0;
  private fps = 0;

  constructor(options: AvatarAnimationEngineOptions = {}) {
    this.random = options.random ?? createRandom();
    this.gestures = new GestureEngine(this.random);
    this.controllers = options.controllers ?? defaultControllers();
  }

  get currentState() {
    return this.state;
  }

  get currentPose(): AvatarPose {
    return this.pose;
  }

  controller<T extends AnimationController>(name: string): T | undefined {
    return this.controllers.find((c) => c.name === name) as T | undefined;
  }

  setRenderer(renderer: AvatarRenderer | null) {
    this.renderer = renderer;
  }

  setState(state: ExaminerState) {
    if (state === this.state) return;
    this.state = state;
    this.stateStart = this.time;
    this.gestures.resetAuto();
    const ctx = this.context(0);
    for (const c of this.controllers) c.onStateChange?.(ctx);
  }

  dispatch(event: AvatarEvent) {
    if (event.type === "gesture") {
      this.gestures.trigger(event.gesture, this.time);
      return;
    }
    const ctx = this.context(0);
    for (const c of this.controllers) c.handle?.(event, ctx);
  }

  setOverrides(overrides: PoseOverrides) {
    this.overrides = overrides;
  }

  subscribe(listener: (snap: EngineSnapshot) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private context(dt: number): AnimationContext {
    return {
      time: this.time,
      dt,
      state: this.state,
      stateTime: this.time - this.stateStart,
      behavior: STATE_BEHAVIORS[this.state],
      gestures: this.gestures,
      lipSync: this.lipSync.output,
      random: this.random,
      signals: this.signals,
    };
  }

  /** Advance the animation by `dt` seconds and return the new pose (also renders it if a renderer is attached). */
  step(dt: number): AvatarPose {
    const safeDt = clamp(dt, 0, 0.1); // a background tab must not make everything jump
    this.time += safeDt;
    this.signals.saccade = 0;
    this.lipSync.update(safeDt);
    this.gestures.update(this.time, STATE_BEHAVIORS[this.state]);
    const ctx = this.context(safeDt);
    const pose = neutralPose();
    for (const c of this.controllers) c.update(ctx, pose);
    this.applyOverrides(pose);
    this.pose = pose;
    this.renderer?.render(pose);
    const snap = { state: this.state, pose, fps: this.fps };
    for (const l of this.listeners) l(snap);
    return pose;
  }

  private applyOverrides(pose: AvatarPose) {
    const o = this.overrides;
    if (o.gazeX !== undefined) pose.gaze.x = o.gazeX;
    if (o.gazeY !== undefined) pose.gaze.y = o.gazeY;
    if (o.lids !== undefined) pose.lids.left = pose.lids.right = o.lids;
    if (o.browRaise !== undefined) pose.brows.raise = o.browRaise;
    if (o.browFurrow !== undefined) pose.brows.furrow = o.browFurrow;
    if (o.mouthOpen !== undefined) pose.mouth.open = o.mouthOpen;
    if (o.smile !== undefined) pose.mouth.smile = o.smile;
    if (o.headYaw !== undefined) pose.head.yaw = o.headYaw;
    if (o.headPitch !== undefined) pose.head.pitch = o.headPitch;
    if (o.headRoll !== undefined) pose.head.roll = o.headRoll;
    if (o.lean !== undefined) pose.torso.lean = o.lean;
    if (o.handX !== undefined) pose.hand.x = o.handX;
    if (o.handY !== undefined) pose.hand.y = o.handY;
  }

  start() {
    if (this.raf) return;
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      const dt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      this.step(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

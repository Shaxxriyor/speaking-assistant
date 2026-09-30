import type { AvatarEvent, AvatarPose, ExaminerState } from "@/types/avatar";
import type { GestureEngine } from "../gestures/GestureEngine";
import type { LipSyncOutput } from "../lipsync/LipSyncEngine";
import type { StateBehavior } from "../state/behaviors";

/** Per-frame signals controllers pass to controllers that run after them. Reset every frame. */
export interface FrameSignals {
  /** Size of a gaze jump that started this frame (0 if none). Big jumps often come with a blink. */
  saccade: number;
}

export interface AnimationContext {
  /** Seconds since the engine started. */
  time: number;
  /** Seconds since the previous frame. */
  dt: number;
  state: ExaminerState;
  /** Seconds since the current state began. */
  stateTime: number;
  behavior: StateBehavior;
  gestures: GestureEngine;
  lipSync: LipSyncOutput;
  random: () => number;
  signals: FrameSignals;
}

/**
 * One independent part of the examiner's behaviour (eyes, head, hands, …).
 * Each frame the engine runs all controllers in order on a fresh neutral pose; each writes (usually adds) its
 * channels. Controllers keep their own state and never touch the renderer.
 */
export interface AnimationController {
  readonly name: string;
  update(ctx: AnimationContext, pose: AvatarPose): void;
  /** Optional: react to an imperative event (blink now, look at the laptop, …). */
  handle?(event: AvatarEvent, ctx: AnimationContext): void;
  /** Optional: called when the examiner state changes. */
  onStateChange?(ctx: AnimationContext): void;
}

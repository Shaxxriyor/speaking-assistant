/** High-level behaviour of the examiner. The exam engine sets it; the avatar translates it into motion. */
export enum ExaminerState {
  IDLE = "IDLE",
  GREETING = "GREETING",
  LISTENING = "LISTENING",
  THINKING = "THINKING",
  SPEAKING = "SPEAKING",
  READING = "READING",
  WRITING = "WRITING",
  NEXT_QUESTION = "NEXT_QUESTION",
  ENDING = "ENDING",
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Everything the renderer needs to draw one frame, in renderer-independent units.
 * Controllers write into it every frame; any renderer (photo rig today, 3D or neural later) consumes it.
 *
 * Units: most values are normalised to roughly -1..1 or 0..1; the renderer decides how far that moves pixels.
 */
export interface AvatarPose {
  /** Eye direction relative to looking at the candidate. x > 0 = her left (screen right), y > 0 = down. */
  gaze: Vec2;
  /** Eyelid closure per eye, 0 open … 1 closed. "left"/"right" as seen on screen. */
  lids: { left: number; right: number };
  /** raise: -1 lowered … 1 raised. furrow: 0 … 1 inner brows drawn together (concentration). */
  brows: { raise: number; furrow: number };
  /** open: 0 … 1 jaw/lip opening. smile: -1 (corners down) … 1 relative to the reference photo. wide: -1 round … 1 spread. */
  mouth: { open: number; smile: number; wide: number };
  /** yaw/pitch: -1 … 1 (turn right / look down positive). roll: radians. x/y: small offsets in face widths. */
  head: { yaw: number; pitch: number; roll: number; x: number; y: number };
  /** breath: -1 … 1 phase of breathing. lean: 0 … 1 forward. shift: -1 … 1 sideways weight shift. */
  torso: { breath: number; lean: number; shift: number };
  /** Writing hand offset (-1 … 1, ~a few mm of pen travel) and pen lift 0 … 1. */
  hand: { x: number; y: number; penLift: number };
}

export function neutralPose(): AvatarPose {
  return {
    gaze: { x: 0, y: 0 },
    lids: { left: 0, right: 0 },
    brows: { raise: 0, furrow: 0 },
    mouth: { open: 0, smile: 0, wide: 0 },
    head: { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0 },
    torso: { breath: 0, lean: 0, shift: 0 },
    hand: { x: 0, y: 0, penLift: 0 },
  };
}

/** Named places she can look at in the room. */
export type GazeTargetName = "candidate" | "papers" | "laptop" | "left" | "right" | "up" | "down";

export type ExpressionName = "neutral" | "warm" | "attentive" | "thinking" | "speaking" | "reading" | "concerned";

export type GestureName =
  | "nod"
  | "doubleNod"
  | "headTilt"
  | "browFlash"
  | "acknowledge"
  | "penTap"
  | "handRaise"
  | "shoulderShift"
  | "lookDownUp";

/** Imperative commands for the avatar (used by the exam flow and the developer panel). */
export type AvatarEvent =
  | { type: "blink" }
  | { type: "lookAt"; target: GazeTargetName | Vec2; holdMs?: number }
  | { type: "gesture"; gesture: GestureName }
  | { type: "expression"; expression: ExpressionName; holdMs?: number }
  | { type: "writing"; active: boolean };

/** Per-channel manual overrides from the developer panel (applied last, on top of all controllers). */
export type PoseOverrides = Partial<{
  gazeX: number;
  gazeY: number;
  lids: number;
  browRaise: number;
  browFurrow: number;
  mouthOpen: number;
  smile: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  lean: number;
  handX: number;
  handY: number;
}>;

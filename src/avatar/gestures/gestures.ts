import type { GestureName } from "@/types/avatar";
import { bell } from "@/utils/math";

/** Pose channels a gesture can drive (additively). */
export type GestureChannel =
  | "headPitch"
  | "headRoll"
  | "headYaw"
  | "browRaise"
  | "smile"
  | "gazeY"
  | "handX"
  | "handY"
  | "penLift"
  | "torsoShift"
  | "torsoLean";

export interface GestureDefinition {
  durationMs: number;
  /** Channel curves over normalised time t ∈ [0, 1]. Values are small: gestures must stay subtle. */
  channels: Partial<Record<GestureChannel, (t: number) => number>>;
}

/** Two bumps (e.g. a double nod or a double pen tap). */
const twice = (t: number) => (t < 0.5 ? bell(t * 2) : bell((t - 0.5) * 2) * 0.8);

export const GESTURES: Record<GestureName, GestureDefinition> = {
  nod: { durationMs: 750, channels: { headPitch: (t) => 0.32 * bell(t) } },
  doubleNod: { durationMs: 1100, channels: { headPitch: (t) => 0.25 * twice(t) } },
  headTilt: { durationMs: 2200, channels: { headRoll: (t) => 0.035 * bell(t) } },
  browFlash: { durationMs: 550, channels: { browRaise: (t) => 0.35 * bell(t) } },
  acknowledge: {
    durationMs: 900,
    channels: { headPitch: (t) => 0.22 * bell(t), browRaise: (t) => 0.2 * bell(t), smile: (t) => 0.15 * bell(t) },
  },
  penTap: { durationMs: 600, channels: { penLift: (t) => 0.6 * twice(t) } },
  handRaise: {
    durationMs: 1600,
    channels: { handY: (t) => -0.7 * bell(t), handX: (t) => 0.2 * bell(t), penLift: (t) => 0.8 * bell(t) },
  },
  shoulderShift: { durationMs: 2800, channels: { torsoShift: (t) => 0.6 * bell(t), torsoLean: (t) => 0.15 * bell(t) } },
  lookDownUp: { durationMs: 1500, channels: { gazeY: (t) => 0.9 * bell(t), headPitch: (t) => 0.25 * bell(t) } },
};

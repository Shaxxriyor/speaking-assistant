import type { GazeTargetName, Vec2 } from "@/types/avatar";

/**
 * Where each named target sits relative to looking straight at the candidate (the camera), as an eye direction.
 * Tuned to the reference room: the papers are on the desk in front of her, the laptop to her left (screen right).
 */
export const GAZE_TARGETS: Record<GazeTargetName, Vec2> = {
  candidate: { x: 0, y: 0 },
  papers: { x: -0.05, y: 1 },
  laptop: { x: 0.8, y: 0.45 },
  left: { x: -0.85, y: 0 },
  right: { x: 0.85, y: 0 },
  up: { x: 0.25, y: -0.7 },
  down: { x: 0, y: 0.8 },
};

/** How much of a gaze shift the head follows (eyes lead, head follows partially), per axis. */
export const HEAD_FOLLOW = { x: 0.35, y: 0.45 };

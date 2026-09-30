import type { AvatarPose } from "@/types/avatar";

/**
 * Draws the examiner. The animation engine only talks to this interface, so the photo-based renderer can later be
 * replaced (3D head, neural/photoreal renderer, video avatar service) without touching controllers or the exam.
 */
export interface AvatarRenderer {
  /** Load assets and attach to the canvas. Rejects if this renderer can't run here (e.g. no WebGL). */
  mount(canvas: HTMLCanvasElement): Promise<void>;
  /** Draw one frame for `pose`. Called by the engine every animation frame. */
  render(pose: AvatarPose): void;
  /** Canvas size changed (CSS pixels). */
  resize(width: number, height: number, pixelRatio: number): void;
  dispose(): void;
}

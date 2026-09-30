import { describe, expect, it } from "vitest";
import { ExaminerState } from "@/types/avatar";
import { createRandom } from "@/utils/random";
import { BlinkController } from "../controllers/BlinkController";
import { GazeController } from "../controllers/GazeController";
import { AvatarAnimationEngine } from "./AvatarAnimationEngine";

const FRAME = 1 / 60;
const run = (engine: AvatarAnimationEngine, seconds: number, each?: () => void) => {
  for (let t = 0; t < seconds; t += FRAME) {
    engine.step(FRAME);
    each?.();
  }
};

describe("BlinkController", () => {
  it("blinks every few seconds, fully closing and reopening", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(7), controllers: [new BlinkController()] });
    let blinks = 0;
    let wasClosed = false;
    run(engine, 30, () => {
      const closed = engine.currentPose.lids.left > 0.95;
      if (closed && !wasClosed) blinks++;
      wasClosed = closed;
    });
    expect(blinks).toBeGreaterThanOrEqual(5);
    expect(blinks).toBeLessThanOrEqual(16);
  });

  it("blinks on demand", () => {
    const engine = new AvatarAnimationEngine({ random: () => 0.99, controllers: [new BlinkController()] });
    run(engine, 1.8); // past the first spontaneous blink window
    run(engine, 0.3);
    engine.dispatch({ type: "blink" });
    let max = 0;
    run(engine, 0.3, () => (max = Math.max(max, engine.currentPose.lids.left)));
    expect(max).toBeGreaterThan(0.95);
  });
});

describe("GazeController", () => {
  it("looks at the papers on request, then returns to the candidate", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(3), controllers: [new GazeController()] });
    engine.setState(ExaminerState.GREETING); // no automatic glances
    engine.dispatch({ type: "lookAt", target: "papers", holdMs: 1000 });
    run(engine, 0.4);
    expect(engine.currentPose.gaze.y).toBeGreaterThan(0.85);
    run(engine, 1.2);
    expect(Math.abs(engine.currentPose.gaze.y)).toBeLessThan(0.1);
  });
});

describe("AvatarAnimationEngine", () => {
  it("looks down at the papers while writing", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(5) });
    engine.setState(ExaminerState.WRITING);
    run(engine, 2);
    expect(engine.currentPose.gaze.y).toBeGreaterThan(0.7);
    expect(engine.currentPose.lids.left).toBeGreaterThan(0.25);
  });

  it("adds a nod to the head pitch", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(5) });
    engine.setState(ExaminerState.GREETING);
    run(engine, 1);
    const before = engine.currentPose.head.pitch;
    engine.dispatch({ type: "gesture", gesture: "nod" });
    run(engine, 0.37);
    expect(engine.currentPose.head.pitch - before).toBeGreaterThan(0.2);
  });

  it("applies developer overrides last", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(5) });
    engine.setOverrides({ mouthOpen: 0.8, gazeX: -1 });
    run(engine, 0.1);
    expect(engine.currentPose.mouth.open).toBe(0.8);
    expect(engine.currentPose.gaze.x).toBe(-1);
  });

  it("keeps every channel within sane ranges over a long run in every state", () => {
    const engine = new AvatarAnimationEngine({ random: createRandom(9) });
    for (const state of Object.values(ExaminerState)) {
      engine.setState(state);
      run(engine, 5, () => {
        const p = engine.currentPose;
        for (const v of [p.gaze.x, p.gaze.y, p.head.yaw, p.head.pitch, p.brows.raise, p.mouth.smile, p.hand.x, p.hand.y]) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Math.abs(v)).toBeLessThan(1.6);
        }
        expect(p.lids.left).toBeGreaterThanOrEqual(0);
        expect(p.lids.left).toBeLessThanOrEqual(1);
      });
    }
  });
});

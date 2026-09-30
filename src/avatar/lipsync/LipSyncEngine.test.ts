import { describe, expect, it } from "vitest";
import { LipSyncEngine } from "./LipSyncEngine";

const FRAME = 1 / 60;

describe("LipSyncEngine", () => {
  it("opens the mouth for vowels while speaking and closes it afterwards", () => {
    const lips = new LipSyncEngine();
    lips.begin("Good afternoon, I am your examiner.");
    let max = 0;
    for (let i = 0; i < 90; i++) max = Math.max(max, lips.update(FRAME).open);
    expect(max).toBeGreaterThan(0.4);
    lips.end();
    for (let i = 0; i < 30; i++) lips.update(FRAME);
    expect(lips.output.open).toBeLessThan(0.02);
  });

  it("closes the lips for m/b/p", () => {
    const lips = new LipSyncEngine(10);
    lips.begin("mmmmmmmmmm");
    for (let i = 0; i < 30; i++) lips.update(FRAME);
    expect(lips.output.open).toBeLessThan(0.02);
  });

  it("follows live audio loudness when available", () => {
    const lips = new LipSyncEngine();
    lips.begin("mmmmmmmmmm");
    for (let i = 0; i < 10; i++) {
      lips.pushLevel(0.7);
      lips.update(FRAME);
    }
    expect(lips.output.open).toBeGreaterThan(0.4);
  });
});

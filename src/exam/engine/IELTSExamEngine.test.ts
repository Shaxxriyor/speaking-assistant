import { describe, expect, it } from "vitest";
import { MockExaminerAI } from "@/services/ai/MockExaminerAI";
import { MockSpeechInputProvider } from "@/services/speech/MockSpeechInputProvider";
import { SilentSpeechOutput } from "@/services/speech/SilentSpeechOutput";
import { ExaminerState } from "@/types/avatar";
import { ExamPhase } from "@/types/exam";
import { ExamAbortedError, IELTSExamEngine } from "./IELTSExamEngine";

const LONG_ANSWER = "Well, I think this is quite an interesting question and I would like to explain my view in detail.";

const waitFor = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 1));
  expect(cond()).toBe(true);
};

function makeEngine(answer: (n: number) => string = () => LONG_ANSWER, noteProbability = 0.4) {
  let n = 0;
  let clock = 0;
  const input = new MockSpeechInputProvider(() => answer(n++));
  const engine = new IELTSExamEngine({
    ai: new MockExaminerAI("Muslima", 42),
    input,
    output: new SilentSpeechOutput(() => 0),
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    random: () => 0.9,
    noteProbability,
  });
  return engine;
}

describe("IELTSExamEngine", () => {
  it("runs Greeting → Part 1 → Part 2 → Part 3 → Ending in order", async () => {
    const engine = makeEngine();
    const phases: ExamPhase[] = [];
    engine.on("phase", (p) => phases.push(p));
    const transcript = await engine.start();
    expect(phases).toEqual([ExamPhase.GREETING, ExamPhase.PART_1, ExamPhase.PART_2, ExamPhase.PART_3, ExamPhase.ENDING, ExamPhase.FINISHED]);
    expect(transcript.at(-1)?.text).toMatch(/end of the speaking test/);
  });

  it("asks the expected number of questions with long answers (no follow-ups)", async () => {
    const transcript = await makeEngine().start();
    const answers = transcript.filter((e) => e.speaker === "candidate");
    // 3 greeting + 3 topics × 3 questions + Part 2 talk + rounding-off + 4 Part 3 questions
    expect(answers).toHaveLength(3 + 9 + 2 + 4);
    expect(transcript.some((e) => e.kind === "followUp")).toBe(false);
  });

  it("asks follow-up questions after short answers, within limits", async () => {
    const transcript = await makeEngine(() => "Yes.").start();
    const followUps = transcript.filter((e) => e.kind === "followUp");
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps.filter((e) => e.phase === ExamPhase.PART_1).length).toBeLessThanOrEqual(2);
    expect(followUps.filter((e) => e.phase === ExamPhase.PART_3).length).toBeLessThanOrEqual(2);
  });

  it("shows the cue card and runs the preparation timer in Part 2", async () => {
    const engine = makeEngine();
    const cards: unknown[] = [];
    const prep: number[] = [];
    engine.on("cueCard", (c) => cards.push(c));
    engine.on("preparation", (p) => p && prep.push(p.remainingMs));
    await engine.start();
    expect(cards[0]).toMatchObject({ topic: expect.stringMatching(/^Describe/) });
    expect(cards.at(-1)).toBeNull(); // cleared for Part 3
    expect(prep[0]).toBe(60_000);
    expect(prep.at(-1)).toBe(0);
  });

  it("drives the examiner through speaking, listening, reading and ending states", async () => {
    const engine = makeEngine(undefined, 1);
    const states = new Set<ExaminerState>();
    engine.on("examinerState", (s) => states.add(s));
    await engine.start();
    for (const s of [ExaminerState.GREETING, ExaminerState.SPEAKING, ExaminerState.LISTENING, ExaminerState.READING, ExaminerState.NEXT_QUESTION, ExaminerState.WRITING, ExaminerState.ENDING]) {
      expect(states).toContain(s);
    }
  });

  it("waits for the developer's typed answer and can be stopped", async () => {
    const input = new MockSpeechInputProvider();
    const engine = new IELTSExamEngine({
      ai: new MockExaminerAI("Muslima", 1),
      input,
      output: new SilentSpeechOutput(() => 0),
      sleep: async () => {},
    });
    const run = engine.start();
    await waitFor(() => input.isWaiting);
    expect(input.submit("My name is Aziz.")).toBe(true);
    await waitFor(() => engine.transcript.some((e) => e.speaker === "candidate"));
    expect(engine.transcript.find((e) => e.speaker === "candidate")?.text).toBe("My name is Aziz.");
    engine.stop();
    await expect(run).rejects.toBeInstanceOf(ExamAbortedError);
    expect(engine.currentPhase).toBe(ExamPhase.IDLE);
  });
});

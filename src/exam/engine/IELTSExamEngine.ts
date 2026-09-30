import type { ExaminerAI } from "@/services/ai/ExaminerAI";
import type { SpeechInputProvider } from "@/services/speech/SpeechInputProvider";
import type { SpeechOutputProvider } from "@/services/speech/SpeechOutputProvider";
import { ExaminerState } from "@/types/avatar";
import { EXAM_SEQUENCE, ExamPhase, type ConversationEntry, type CueCard, type ExaminerTurn } from "@/types/exam";

/** Everything observers (UI, avatar, analytics) can react to. */
export interface ExamEvents {
  phase: ExamPhase;
  examinerState: ExaminerState;
  examinerSays: ExaminerTurn;
  cueCard: CueCard | null;
  preparation: { remainingMs: number; totalMs: number } | null;
  awaitingAnswer: { turn: ExaminerTurn; limitMs?: number } | null;
  answer: ConversationEntry;
  finished: readonly ConversationEntry[];
  error: unknown;
}

type Listener<K extends keyof ExamEvents> = (payload: ExamEvents[K]) => void;

export interface ExamEngineDeps {
  ai: ExaminerAI;
  input: SpeechInputProvider;
  output: SpeechOutputProvider;
  /** Injectable for tests. */
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  /** Probability that the examiner writes a note after an answer (instead of a short pause). */
  noteProbability?: number;
  random?: () => number;
}

export class ExamAbortedError extends Error {
  constructor() {
    super("Exam stopped");
    this.name = "ExamAbortedError";
  }
}

const defaultSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new ExamAbortedError());
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ExamAbortedError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

/**
 * Runs the IELTS Speaking test as a state machine:
 * IDLE → GREETING → PART_1 → PART_2 → PART_3 → ENDING → FINISHED.
 * Within each phase it asks the ExaminerAI for turns, speaks them, and collects answers from the
 * SpeechInputProvider. It knows nothing about React, the avatar or how speech is produced/recognised.
 */
export class IELTSExamEngine {
  private listeners = new Map<keyof ExamEvents, Set<Listener<keyof ExamEvents>>>();
  private history: ConversationEntry[] = [];
  private phase = ExamPhase.IDLE;
  private examinerState = ExaminerState.IDLE;
  private abort: AbortController | null = null;
  private skipPrep: (() => void) | null = null;
  private readonly sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly deps: ExamEngineDeps) {
    this.sleep = deps.sleep ?? defaultSleep;
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
  }

  on<K extends keyof ExamEvents>(event: K, listener: Listener<K>) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener as Listener<keyof ExamEvents>);
    return () => {
      set!.delete(listener as Listener<keyof ExamEvents>);
    };
  }

  private emit<K extends keyof ExamEvents>(event: K, payload: ExamEvents[K]) {
    for (const l of this.listeners.get(event) ?? []) (l as Listener<K>)(payload);
  }

  get currentPhase() {
    return this.phase;
  }

  get transcript(): readonly ConversationEntry[] {
    return this.history;
  }

  get isRunning() {
    return this.abort !== null;
  }

  private setPhase(phase: ExamPhase) {
    this.phase = phase;
    this.emit("phase", phase);
  }

  private setExaminer(state: ExaminerState) {
    if (state === this.examinerState) return;
    this.examinerState = state;
    this.emit("examinerState", state);
  }

  /** Run the whole test. Resolves with the transcript when finished; rejects with ExamAbortedError if stopped. */
  async start(): Promise<readonly ConversationEntry[]> {
    if (this.abort) throw new Error("Exam already running");
    const abort = new AbortController();
    this.abort = abort;
    this.history = [];
    this.deps.ai.reset();
    try {
      for (const phase of EXAM_SEQUENCE) {
        this.setPhase(phase);
        if (phase === ExamPhase.PART_3) this.emit("cueCard", null);
        await this.runPhase(phase, abort.signal);
      }
      this.setPhase(ExamPhase.FINISHED);
      this.setExaminer(ExaminerState.IDLE);
      this.emit("finished", this.history);
      return this.history;
    } catch (e) {
      if (!(e instanceof ExamAbortedError) && !abort.signal.aborted) this.emit("error", e);
      throw abort.signal.aborted ? new ExamAbortedError() : e;
    } finally {
      this.abort = null;
    }
  }

  stop() {
    this.abort?.abort();
    this.deps.output.cancel();
    this.emit("awaitingAnswer", null);
    this.emit("preparation", null);
    this.setExaminer(ExaminerState.IDLE);
    this.setPhase(ExamPhase.IDLE);
  }

  /** Part 2: the candidate is ready before the minute is up. */
  skipPreparation() {
    this.skipPrep?.();
  }

  private async runPhase(phase: ExamPhase, signal: AbortSignal) {
    let lastAnswer: string | undefined;
    let first = true;
    for (;;) {
      const turn = await this.deps.ai.nextTurn({ phase, history: this.history, lastAnswer });
      if (signal.aborted) throw new ExamAbortedError();
      if (!turn) return;
      lastAnswer = await this.performTurn(turn, signal, first);
      first = false;
    }
  }

  private async performTurn(turn: ExaminerTurn, signal: AbortSignal, firstInPhase: boolean): Promise<string | undefined> {
    const { output, input } = this.deps;

    // Between questions she glances at her question sheet before asking.
    if ((turn.kind === "question" || turn.kind === "followUp") && !firstInPhase) {
      this.setExaminer(ExaminerState.NEXT_QUESTION);
      await this.sleep(500 + this.random() * 400, signal);
    }

    this.setExaminer(turn.kind === "greeting" ? ExaminerState.GREETING : turn.kind === "closing" ? ExaminerState.ENDING : ExaminerState.SPEAKING);
    this.history.push({ phase: turn.phase, speaker: "examiner", kind: turn.kind, text: turn.text, at: this.now() });
    this.emit("examinerSays", turn);
    await output.speak(turn.text, undefined, signal);
    if (signal.aborted) throw new ExamAbortedError();

    if (turn.cueCard) this.emit("cueCard", turn.cueCard);
    if (turn.prepMs) await this.prepare(turn.prepMs, signal);
    if (turn.kind === "closing") {
      this.setExaminer(ExaminerState.ENDING);
      await this.sleep(1500, signal);
    }
    if (!turn.expectsAnswer) return undefined;

    this.setExaminer(ExaminerState.LISTENING);
    this.emit("awaitingAnswer", { turn, limitMs: turn.answerLimitMs });
    let text: string;
    try {
      text = await input.transcribe({ maxDurationMs: turn.answerLimitMs, signal });
    } catch (e) {
      if (signal.aborted) throw new ExamAbortedError();
      throw e;
    } finally {
      this.emit("awaitingAnswer", null);
    }
    const entry: ConversationEntry = { phase: turn.phase, speaker: "candidate", kind: "answer", text, at: this.now() };
    this.history.push(entry);
    this.emit("answer", entry);

    // Examiners often jot a quick note after an answer.
    if (this.random() < (this.deps.noteProbability ?? 0.4)) {
      this.setExaminer(ExaminerState.WRITING);
      await this.sleep(900 + this.random() * 700, signal);
    } else {
      this.setExaminer(ExaminerState.THINKING);
      await this.sleep(300 + this.random() * 300, signal);
    }
    return text;
  }

  private async prepare(totalMs: number, signal: AbortSignal) {
    // While the candidate prepares, the examiner reads/writes quietly.
    this.setExaminer(ExaminerState.READING);
    const endAt = this.now() + totalMs;
    let skipped = false;
    this.skipPrep = () => (skipped = true);
    try {
      while (!skipped) {
        const remainingMs = Math.max(0, endAt - this.now());
        this.emit("preparation", { remainingMs, totalMs });
        if (remainingMs <= 0) break;
        await this.sleep(Math.min(250, remainingMs), signal);
      }
    } finally {
      this.skipPrep = null;
      this.emit("preparation", null);
    }
  }
}

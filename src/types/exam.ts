export enum ExamPhase {
  IDLE = "IDLE",
  GREETING = "GREETING",
  PART_1 = "PART_1",
  PART_2 = "PART_2",
  PART_3 = "PART_3",
  ENDING = "ENDING",
  FINISHED = "FINISHED",
}

/** The phases the exam moves through, in order. */
export const EXAM_SEQUENCE: readonly ExamPhase[] = [
  ExamPhase.GREETING,
  ExamPhase.PART_1,
  ExamPhase.PART_2,
  ExamPhase.PART_3,
  ExamPhase.ENDING,
];

export interface CueCard {
  topic: string;
  points: string[];
}

export type TurnKind = "greeting" | "question" | "followUp" | "instruction" | "cueCard" | "transition" | "closing";

/** One thing the examiner says, and what should happen after it. */
export interface ExaminerTurn {
  kind: TurnKind;
  text: string;
  phase: ExamPhase;
  /** The candidate answers after this turn. */
  expectsAnswer: boolean;
  /** Maximum answer length in ms (the examiner politely stops the candidate after it). */
  answerLimitMs?: number;
  /** Part 2: show this card to the candidate. */
  cueCard?: CueCard;
  /** Part 2: preparation time before the next turn. */
  prepMs?: number;
}

export interface ConversationEntry {
  phase: ExamPhase;
  speaker: "examiner" | "candidate";
  kind: TurnKind | "answer";
  text: string;
  at: number;
}

/** Everything the examiner AI may use to decide its next turn. */
export interface ConversationContext {
  phase: ExamPhase;
  history: readonly ConversationEntry[];
  /** The candidate's last answer, if the previous turn expected one. */
  lastAnswer?: string;
}

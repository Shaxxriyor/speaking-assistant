import { ExaminerState, type ExpressionName, type GazeTargetName, type GestureName } from "@/types/avatar";

/** How the examiner tends to behave in each state. Controllers read this; nothing here moves anything directly. */
export interface StateBehavior {
  /** Where she mainly looks. */
  gaze: GazeTargetName;
  /** Occasional short glances elsewhere, e.g. at her notes while listening. */
  glances: { value: GazeTargetName; weight: number }[];
  glanceEveryMs: [number, number];
  glanceHoldMs: [number, number];
  expression: ExpressionName;
  blinkIntervalMs: [number, number];
  /** 0 … 1 amount of idle head/body motion. */
  activity: number;
  /** 0 … 1 forward lean. */
  lean: number;
  writing: boolean;
  /** Gestures performed now and then while in this state. */
  autoGestures: { gesture: GestureName; everyMs: [number, number] }[];
}

const base: StateBehavior = {
  gaze: "candidate",
  glances: [],
  glanceEveryMs: [5000, 10000],
  glanceHoldMs: [800, 1600],
  expression: "neutral",
  blinkIntervalMs: [2500, 6000],
  activity: 0.5,
  lean: 0.15,
  writing: false,
  autoGestures: [],
};

export const STATE_BEHAVIORS: Record<ExaminerState, StateBehavior> = {
  [ExaminerState.IDLE]: {
    ...base,
    glances: [
      { value: "papers", weight: 3 },
      { value: "laptop", weight: 1 },
    ],
    glanceEveryMs: [4000, 9000],
    glanceHoldMs: [1000, 2500],
    activity: 0.6,
    lean: 0.05,
    autoGestures: [{ gesture: "shoulderShift", everyMs: [18000, 35000] }],
  },
  [ExaminerState.GREETING]: { ...base, expression: "warm", blinkIntervalMs: [2000, 5000], activity: 0.7, lean: 0.2 },
  [ExaminerState.LISTENING]: {
    ...base,
    glances: [{ value: "papers", weight: 1 }],
    glanceEveryMs: [7000, 13000],
    glanceHoldMs: [700, 1400],
    expression: "attentive",
    blinkIntervalMs: [3000, 7000],
    activity: 0.4,
    lean: 0.35,
    autoGestures: [
      { gesture: "nod", everyMs: [3500, 7500] },
      { gesture: "browFlash", everyMs: [9000, 16000] },
    ],
  },
  [ExaminerState.THINKING]: {
    ...base,
    gaze: "papers",
    expression: "thinking",
    blinkIntervalMs: [2000, 4000],
    activity: 0.3,
    lean: 0.2,
    autoGestures: [{ gesture: "headTilt", everyMs: [3000, 6000] }],
  },
  [ExaminerState.SPEAKING]: {
    ...base,
    glances: [{ value: "papers", weight: 1 }],
    glanceEveryMs: [5000, 10000],
    glanceHoldMs: [500, 1100],
    expression: "speaking",
    blinkIntervalMs: [2000, 4500],
    activity: 0.8,
    lean: 0.25,
    autoGestures: [
      { gesture: "browFlash", everyMs: [5000, 9000] },
      { gesture: "handRaise", everyMs: [9000, 16000] },
    ],
  },
  [ExaminerState.READING]: {
    ...base,
    gaze: "papers",
    expression: "reading",
    blinkIntervalMs: [4000, 8000],
    activity: 0.25,
    lean: 0.3,
  },
  [ExaminerState.WRITING]: {
    ...base,
    gaze: "papers",
    expression: "reading",
    blinkIntervalMs: [4000, 8000],
    activity: 0.2,
    lean: 0.35,
    writing: true,
  },
  [ExaminerState.NEXT_QUESTION]: {
    ...base,
    gaze: "papers",
    expression: "neutral",
    activity: 0.4,
    lean: 0.25,
    autoGestures: [{ gesture: "penTap", everyMs: [2500, 5000] }],
  },
  [ExaminerState.ENDING]: {
    ...base,
    expression: "warm",
    activity: 0.6,
    lean: 0.1,
    autoGestures: [{ gesture: "nod", everyMs: [4000, 8000] }],
  },
};

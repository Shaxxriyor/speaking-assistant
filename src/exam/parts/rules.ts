/** Timing and structure of each part of the IELTS Speaking test. */
export const EXAM_RULES = {
  part1: { topics: 2, questionsPerTopic: 3, answerLimitMs: 45_000, maxFollowUpsPerTopic: 1 },
  part2: { prepMs: 60_000, talkLimitMs: 120_000, roundingOffLimitMs: 30_000 },
  part3: { questions: 4, answerLimitMs: 75_000, maxFollowUps: 2 },
  greeting: { answerLimitMs: 30_000 },
  /** Answers shorter than this (in words) may get a follow-up question. */
  shortAnswerWords: 8,
} as const;

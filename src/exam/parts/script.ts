import { PART1_TOPICS, PART2_TASKS, WORK_OR_STUDY, type Part1Topic, type Part2Task } from "../questions/bank";
import { EXAM_RULES } from "./rules";

/** The questions chosen for one test session. */
export interface ExamScript {
  part1: Part1Topic[];
  part2: Part2Task;
}

/** Pick topics for a new session (work/study first, then random topics and a random cue card). */
export function createExamScript(random: () => number): ExamScript {
  const pool = [...PART1_TOPICS];
  const part1: Part1Topic[] = [WORK_OR_STUDY];
  while (part1.length < EXAM_RULES.part1.topics + 1 && pool.length) part1.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return { part1, part2: PART2_TASKS[Math.floor(random() * PART2_TASKS.length)] };
}

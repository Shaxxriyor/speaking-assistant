export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const PHASE_LABEL: Record<string, string> = {
  IDLE: "Not started",
  GREETING: "Introduction",
  PART_1: "Part 1",
  PART_2: "Part 2",
  PART_3: "Part 3",
  ENDING: "Ending",
  FINISHED: "Finished",
};

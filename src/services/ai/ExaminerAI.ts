import type { ConversationContext, ExaminerTurn } from "@/types/exam";

/**
 * Decides what the examiner says next within the current phase. The exam engine owns phase transitions; the AI
 * returns `null` when it has nothing more to say in a phase. A future LLM-backed implementation plugs in here.
 */
export interface ExaminerAI {
  /** Prepare a fresh test session. */
  reset(): void;
  nextTurn(context: ConversationContext): Promise<ExaminerTurn | null>;
}

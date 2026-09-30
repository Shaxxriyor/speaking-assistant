import { EXAM_RULES } from "@/exam/parts/rules";
import { createExamScript, type ExamScript } from "@/exam/parts/script";
import { ExamPhase, type ConversationContext, type ExaminerTurn, type TurnKind } from "@/types/exam";
import { createRandom } from "@/utils/random";
import type { ExaminerAI } from "./ExaminerAI";

const FOLLOW_UPS_PART1 = ["Why is that?", "Could you tell me a little more about that?", "Can you give me an example?"];
const FOLLOW_UPS_PART3 = ["Why do you think that is?", "Could you explain that a bit more?", "Is that true for everyone, do you think?"];

const words = (s?: string) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);

/**
 * Scripted examiner following the official test structure, with simple follow-ups for short answers.
 * Deterministic for a given seed.
 */
export class MockExaminerAI implements ExaminerAI {
  private script!: ExamScript;
  private queue: ExaminerTurn[] = [];
  private phase: ExamPhase = ExamPhase.IDLE;
  private followUps = 0;
  private lastWasFollowUp = false;
  private random: () => number;

  constructor(
    private readonly examinerName = "Muslima",
    seed?: number,
  ) {
    this.random = createRandom(seed);
    this.reset();
  }

  reset() {
    this.script = createExamScript(this.random);
    this.queue = [];
    this.phase = ExamPhase.IDLE;
  }

  get selectedScript(): ExamScript {
    return this.script;
  }

  private turn(kind: TurnKind, text: string, extra: Partial<ExaminerTurn> = {}): ExaminerTurn {
    return { kind, text, phase: this.phase, expectsAnswer: false, ...extra };
  }

  private ask(text: string, answerLimitMs: number, kind: TurnKind = "question"): ExaminerTurn {
    return this.turn(kind, text, { expectsAnswer: true, answerLimitMs });
  }

  private plan(phase: ExamPhase): ExaminerTurn[] {
    const r = EXAM_RULES;
    switch (phase) {
      case ExamPhase.GREETING:
        return [
          this.ask(`Good afternoon. My name is ${this.examinerName}, and I'll be your examiner today. Can you tell me your full name, please?`, r.greeting.answerLimitMs, "greeting"),
          this.ask("Thank you. And what can I call you?", r.greeting.answerLimitMs, "greeting"),
          this.ask("And where are you from?", r.greeting.answerLimitMs, "greeting"),
        ];
      case ExamPhase.PART_1:
        return [
          this.turn("transition", "Thank you. Now, in this first part of the test, I'd like to ask you some questions about yourself."),
          ...this.script.part1.flatMap((topic) =>
            topic.questions.slice(0, r.part1.questionsPerTopic).map((q, i) => this.ask(i === 0 ? `${topic.intro} ${q}` : q, r.part1.answerLimitMs)),
          ),
        ];
      case ExamPhase.PART_2: {
        const task = this.script.part2;
        return [
          this.turn(
            "cueCard",
            "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish. Here is your topic.",
            { cueCard: task.cueCard, prepMs: r.part2.prepMs },
          ),
          this.ask("All right? Remember, you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?", r.part2.talkLimitMs, "instruction"),
          this.ask(`Thank you. ${task.roundingOff}`, r.part2.roundingOffLimitMs),
        ];
      }
      case ExamPhase.PART_3: {
        const task = this.script.part2;
        const [first, ...rest] = task.part3.slice(0, r.part3.questions);
        return [
          this.ask(`We've been talking about ${task.cueCard.topic.replace(/^Describe /, "").replace(/\.$/, "")}. I'd like to discuss with you one or two more general questions related to ${task.theme}. ${first}`, r.part3.answerLimitMs),
          ...rest.map((q) => this.ask(q, r.part3.answerLimitMs)),
        ];
      }
      case ExamPhase.ENDING:
        return [this.turn("closing", "Thank you. That is the end of the speaking test.")];
      default:
        return [];
    }
  }

  private followUp(context: ConversationContext): ExaminerTurn | null {
    if (this.lastWasFollowUp || context.lastAnswer === undefined) return null;
    if (words(context.lastAnswer) >= EXAM_RULES.shortAnswerWords) return null;
    const pool =
      context.phase === ExamPhase.PART_1 ? FOLLOW_UPS_PART1 : context.phase === ExamPhase.PART_3 ? FOLLOW_UPS_PART3 : null;
    const limit = context.phase === ExamPhase.PART_1 ? EXAM_RULES.part1.maxFollowUpsPerTopic * EXAM_RULES.part1.topics : EXAM_RULES.part3.maxFollowUps;
    if (!pool || this.followUps >= limit) return null;
    this.followUps++;
    const limitMs = context.phase === ExamPhase.PART_1 ? EXAM_RULES.part1.answerLimitMs : EXAM_RULES.part3.answerLimitMs;
    return this.ask(pool[Math.floor(this.random() * pool.length)], limitMs, "followUp");
  }

  async nextTurn(context: ConversationContext): Promise<ExaminerTurn | null> {
    if (context.phase !== this.phase) {
      this.phase = context.phase;
      this.queue = this.plan(context.phase);
      this.followUps = 0;
      this.lastWasFollowUp = false;
      return this.queue.shift() ?? null;
    }
    const follow = this.followUp(context);
    if (follow) {
      this.lastWasFollowUp = true;
      return follow;
    }
    this.lastWasFollowUp = false;
    return this.queue.shift() ?? null;
  }
}

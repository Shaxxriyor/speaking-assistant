"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AvatarAnimationEngine } from "@/avatar/engine/AvatarAnimationEngine";
import { withLipSync } from "@/avatar/lipsync/withLipSync";
import { EXAMINER } from "@/config/examiner";
import { ExamAbortedError, IELTSExamEngine } from "@/exam/engine/IELTSExamEngine";
import { MockExaminerAI } from "@/services/ai/MockExaminerAI";
import { createSpeechOutput } from "@/services/speech/createSpeechOutput";
import { MockSpeechInputProvider } from "@/services/speech/MockSpeechInputProvider";
import type { SpeechOutputProvider } from "@/services/speech/SpeechOutputProvider";
import { ExaminerState } from "@/types/avatar";
import { ExamPhase, type ConversationEntry, type CueCard, type ExaminerTurn } from "@/types/exam";

export interface ExamSessionView {
  phase: ExamPhase;
  examinerState: ExaminerState;
  caption: string;
  cueCard: CueCard | null;
  preparation: { remainingMs: number; totalMs: number } | null;
  awaiting: { turn: ExaminerTurn; limitMs?: number } | null;
  transcript: readonly ConversationEntry[];
  running: boolean;
  error: string | null;
}

const initialView: ExamSessionView = {
  phase: ExamPhase.IDLE,
  examinerState: ExaminerState.IDLE,
  caption: "",
  cueCard: null,
  preparation: null,
  awaiting: null,
  transcript: [],
  running: false,
  error: null,
};

/**
 * Composition root for one exam session: creates the avatar engine, voice, mock speech input, mock examiner AI and
 * the exam engine, wires exam events to the avatar, and exposes view state + actions to React.
 */
export function useExamSession() {
  const avatar = useMemo(() => new AvatarAnimationEngine(), []);
  const input = useMemo(() => new MockSpeechInputProvider(), []);
  const ai = useMemo(() => new MockExaminerAI(EXAMINER.name), []);
  const [voice, setVoice] = useState<SpeechOutputProvider | null>(null);
  const [view, setView] = useState<ExamSessionView>(initialView);

  // Choose the voice once we know whether the server has an OpenAI key.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json())
      .catch(() => ({}))
      .then((s: { openaiVoice?: boolean }) => {
        if (!cancelled) setVoice(withLipSync(createSpeechOutput({ openai: Boolean(s.openaiVoice) }), avatar.lipSync));
      });
    return () => {
      cancelled = true;
    };
  }, [avatar]);

  const exam = useMemo(() => (voice ? new IELTSExamEngine({ ai, input, output: voice }) : null), [ai, input, voice]);

  useEffect(() => {
    if (!exam) return;
    const patch = (p: Partial<ExamSessionView>) => setView((v) => ({ ...v, ...p }));
    const offs = [
      exam.on("phase", (phase) => patch({ phase })),
      exam.on("examinerState", (state) => {
        avatar.setState(state);
        patch({ examinerState: state });
      }),
      exam.on("examinerSays", (turn) => patch({ caption: turn.text })),
      exam.on("cueCard", (cueCard) => patch({ cueCard })),
      exam.on("preparation", (preparation) => patch({ preparation })),
      exam.on("awaitingAnswer", (awaiting) => patch({ awaiting })),
      exam.on("answer", () => {
        patch({ transcript: [...exam.transcript] });
        avatar.dispatch({ type: "gesture", gesture: "acknowledge" });
      }),
      exam.on("finished", (transcript) => patch({ transcript: [...transcript], running: false, caption: "" })),
      exam.on("error", (e) => patch({ error: e instanceof Error ? e.message : String(e), running: false })),
    ];
    return () => {
      offs.forEach((off) => off());
      exam.stop();
    };
  }, [avatar, exam]);

  const start = useCallback(() => {
    if (!exam || exam.isRunning) return;
    voice?.unlock?.(); // must happen inside the click
    setView({ ...initialView, running: true });
    exam.start().catch((e) => {
      if (!(e instanceof ExamAbortedError)) console.error(e);
    });
  }, [exam, voice]);

  const stop = useCallback(() => {
    exam?.stop();
    setView((v) => ({ ...v, running: false, awaiting: null, preparation: null, caption: "" }));
  }, [exam]);

  const submitAnswer = useCallback((text: string) => input.submit(text), [input]);
  const skipPreparation = useCallback(() => exam?.skipPreparation(), [exam]);

  return { view, avatar, voice, ready: Boolean(exam), start, stop, submitAnswer, skipPreparation };
}

export type ExamSession = ReturnType<typeof useExamSession>;

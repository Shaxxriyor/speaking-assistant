"use client";

import { DevPanel } from "@/components/dev/DevPanel";
import { useDevMode } from "@/components/dev/useDevMode";
import { ExaminerView } from "@/components/examiner/ExaminerView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { EXAMINER } from "@/config/examiner";
import { ExamPhase } from "@/types/exam";
import { useState } from "react";
import { CandidateInput } from "./CandidateInput";
import { CaptionBar } from "./CaptionBar";
import { CueCardPanel } from "./CueCardPanel";
import { PHASE_LABEL } from "./format";
import { PreparationTimer } from "./PreparationTimer";
import { TranscriptView } from "./TranscriptView";
import { useExamSession } from "./useExamSession";

/** The candidate's view of the speaking test: the examiner across the desk, and the controls below. */
export function ExamRoom() {
  const session = useExamSession();
  const { view } = session;
  const [captions, setCaptions] = useState(true);
  const dev = useDevMode();
  const finished = view.phase === ExamPhase.FINISHED;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 py-4 sm:py-6">
      <header className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-slate-100">IELTS Speaking</span>
        {view.phase !== ExamPhase.IDLE && <Badge tone={view.running ? "live" : "neutral"}>{PHASE_LABEL[view.phase]}</Badge>}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-slate-400">
          <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="accent-emerald-400" />
          Captions
        </label>
        {view.running && (
          <Button variant="ghost" className="py-1" onClick={session.stop}>
            End test
          </Button>
        )}
      </header>

      <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-slate-800">
        <ExaminerView engine={session.avatar} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-4 pb-3 pt-10">
          <CaptionBar text={view.caption} visible={captions && view.running} />
          <p className="mt-2 text-xs text-slate-300 sm:text-sm">
            <strong className="text-slate-50">{EXAMINER.name}</strong> · {EXAMINER.title}
          </p>
        </div>
      </div>

      <section className="flex flex-col items-center gap-4">
        {!view.running && !finished && (
          <Panel className="w-full text-center">
            <h1 className="text-xl font-semibold text-slate-50">Full IELTS Speaking test</h1>
            <p className="mt-2 text-slate-400">About 12 minutes · Introduction, Parts 1, 2 and 3.</p>
            <p className="mt-1 text-sm text-amber-200/80">Prototype: type your answers in the box that appears (no microphone yet).</p>
            <Button variant="primary" className="mt-4" onClick={session.start} disabled={!session.ready}>
              {session.ready ? "Start the test" : "Loading…"}
            </Button>
          </Panel>
        )}

        {view.running && view.cueCard && <CueCardPanel card={view.cueCard} />}
        {view.running && view.preparation && (
          <PreparationTimer remainingMs={view.preparation.remainingMs} totalMs={view.preparation.totalMs} onSkip={session.skipPreparation} />
        )}
        {view.running && view.awaiting && <CandidateInput onSubmit={session.submitAnswer} limitMs={view.awaiting.limitMs} />}
        {view.error && <p className="text-red-400">{view.error}</p>}

        {finished && (
          <Panel className="w-full">
            <h1 className="text-xl font-semibold text-slate-50">Test complete</h1>
            <p className="mb-4 mt-1 text-slate-400">Transcript of the test. Band-score feedback comes in a later stage.</p>
            <TranscriptView entries={view.transcript} />
            <Button variant="primary" className="mt-5" onClick={session.start}>
              Take the test again
            </Button>
          </Panel>
        )}
      </section>

      {dev.open && <DevPanel session={session} onClose={dev.close} />}
    </main>
  );
}

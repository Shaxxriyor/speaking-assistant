"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EngineSnapshot } from "@/avatar/engine/AvatarAnimationEngine";
import type { ExamSession } from "@/components/exam-room/useExamSession";
import { ExaminerState, type ExpressionName, type GazeTargetName, type GestureName, type PoseOverrides } from "@/types/avatar";

const STATES = Object.values(ExaminerState);
const GESTURES: GestureName[] = ["nod", "doubleNod", "headTilt", "browFlash", "acknowledge", "penTap", "handRaise", "shoulderShift", "lookDownUp"];
const TARGETS: GazeTargetName[] = ["candidate", "papers", "laptop", "left", "right", "up", "down"];
const EXPRESSIONS: ExpressionName[] = ["neutral", "warm", "attentive", "thinking", "speaking", "reading", "concerned"];
const SLIDERS: { key: keyof PoseOverrides; label: string; min: number; max: number }[] = [
  { key: "gazeX", label: "Gaze X", min: -1, max: 1 },
  { key: "gazeY", label: "Gaze Y", min: -1, max: 1 },
  { key: "lids", label: "Eyelids", min: 0, max: 1 },
  { key: "browRaise", label: "Brow raise", min: -1, max: 1 },
  { key: "browFurrow", label: "Brow furrow", min: 0, max: 1 },
  { key: "mouthOpen", label: "Mouth open", min: 0, max: 1 },
  { key: "smile", label: "Smile", min: -1, max: 1 },
  { key: "headYaw", label: "Head yaw", min: -1, max: 1 },
  { key: "headPitch", label: "Head pitch", min: -1, max: 1 },
  { key: "headRoll", label: "Head roll", min: -0.1, max: 0.1 },
  { key: "lean", label: "Lean", min: 0, max: 1 },
  { key: "handX", label: "Hand X", min: -1.5, max: 1.5 },
  { key: "handY", label: "Hand Y", min: -1.5, max: 1.5 },
];
const SAMPLE_LINE = "Now, in this first part of the test, I'd like to ask you some questions about yourself.";

/** "NEXT_QUESTION" → "next question", "doubleNod" → "double nod". */
const label = (s: string) => (s === s.toUpperCase() ? s.replace(/_/g, " ") : s.replace(/([A-Z])/g, " $1")).toLowerCase();

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-800 pt-3">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
        active ? "border-emerald-400 bg-emerald-400/15 text-emerald-200" : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

/** Developer-only controls to drive every avatar system independently and inspect the live pose. */
export function DevPanel({ session, onClose }: { session: ExamSession; onClose: () => void }) {
  const { avatar, voice, view } = session;
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [overrides, setOverrides] = useState<PoseOverrides>({});
  const [line, setLine] = useState(SAMPLE_LINE);
  const [writing, setWriting] = useState(false);

  // Live readout, throttled to ~8 updates per second.
  useEffect(() => {
    let last = 0;
    return avatar.subscribe((s) => {
      const now = performance.now();
      if (now - last > 120) {
        last = now;
        setSnap({ ...s, pose: structuredClone(s.pose) });
      }
    });
  }, [avatar]);

  useEffect(() => avatar.setOverrides(overrides), [avatar, overrides]);
  useEffect(() => () => avatar.setOverrides({}), [avatar]);

  const speak = async () => {
    if (!voice) return;
    voice.unlock?.();
    const previous = avatar.currentState;
    avatar.setState(ExaminerState.SPEAKING);
    await voice.speak(line);
    avatar.setState(previous === ExaminerState.SPEAKING ? ExaminerState.IDLE : previous);
  };

  const p = snap?.pose;
  const fmt = (n: number | undefined) => (n ?? 0).toFixed(2);

  return (
    <aside className="fixed right-3 top-3 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/95 text-slate-200 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <strong className="text-sm">Developer panel</strong>
        <span className="font-mono text-xs text-slate-400">{snap ? `${Math.round(snap.fps)} fps` : ""}</span>
        <button type="button" onClick={onClose} className="rounded px-2 text-slate-400 hover:bg-slate-800" aria-label="Close developer panel">
          ✕
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-400">
          <span>state: <b className="text-emerald-300">{snap?.state}</b></span>
          <span>phase: {view.phase}</span>
          <span>gaze: {fmt(p?.gaze.x)}, {fmt(p?.gaze.y)}</span>
          <span>lids: {fmt(p?.lids.left)}</span>
          <span>head: {fmt(p?.head.yaw)}, {fmt(p?.head.pitch)}</span>
          <span>mouth: {fmt(p?.mouth.open)} / {fmt(p?.mouth.smile)}</span>
          <span>brows: {fmt(p?.brows.raise)}, {fmt(p?.brows.furrow)}</span>
          <span>hand: {fmt(p?.hand.x)}, {fmt(p?.hand.y)}</span>
          <span>voice: {voice?.name ?? "…"}</span>
          <span>lean: {fmt(p?.torso.lean)}</span>
        </div>

        <Section title="Examiner state">
          {STATES.map((s) => (
            <Chip key={s} active={snap?.state === s} onClick={() => avatar.setState(s)}>
              {label(s)}
            </Chip>
          ))}
        </Section>

        <Section title="Actions">
          <Chip onClick={() => avatar.dispatch({ type: "blink" })}>blink</Chip>
          {GESTURES.map((g) => (
            <Chip key={g} onClick={() => avatar.dispatch({ type: "gesture", gesture: g })}>
              {label(g)}
            </Chip>
          ))}
        </Section>

        <Section title="Look at">
          {TARGETS.map((t) => (
            <Chip key={t} onClick={() => avatar.dispatch({ type: "lookAt", target: t, holdMs: 3000 })}>
              {t}
            </Chip>
          ))}
        </Section>

        <Section title="Expression (3 s)">
          {EXPRESSIONS.map((e) => (
            <Chip key={e} onClick={() => avatar.dispatch({ type: "expression", expression: e, holdMs: 3000 })}>
              {e}
            </Chip>
          ))}
        </Section>

        <Section title="Writing">
          <Chip
            active={writing}
            onClick={() => {
              avatar.dispatch({ type: "writing", active: !writing });
              setWriting(!writing);
            }}
          >
            {writing ? "stop writing" : "start writing"}
          </Chip>
        </Section>

        <Section title="Speaking / listening">
          <textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
          <Chip onClick={speak}>speak line</Chip>
          <Chip onClick={() => voice?.cancel()}>stop voice</Chip>
          <Chip onClick={() => avatar.setState(ExaminerState.LISTENING)}>listen</Chip>
        </Section>

        <section className="border-t border-slate-800 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Manual pose (overrides)</h3>
            <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={() => setOverrides({})}>
              reset
            </button>
          </div>
          <div className="space-y-1.5">
            {SLIDERS.map(({ key, label: text, min, max }) => {
              const on = overrides[key] !== undefined;
              return (
                <label key={key} className="grid grid-cols-[16px_78px_1fr_36px] items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setOverrides((o) => {
                        const next = { ...o };
                        if (e.target.checked) next[key] = 0;
                        else delete next[key];
                        return next;
                      })
                    }
                    className="accent-emerald-400"
                  />
                  <span className="text-slate-400">{text}</span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={(max - min) / 200}
                    value={overrides[key] ?? 0}
                    disabled={!on}
                    onChange={(e) => setOverrides((o) => ({ ...o, [key]: Number(e.target.value) }))}
                    className="accent-emerald-400"
                  />
                  <span className="text-right font-mono text-slate-500">{on ? overrides[key]!.toFixed(2) : "auto"}</span>
                </label>
              );
            })}
          </div>
        </section>

        <Section title="Exam">
          <Chip onClick={session.skipPreparation}>skip preparation</Chip>
          <Chip onClick={() => session.submitAnswer("I think that's a really interesting question, and I would say it depends on the situation.")}>
            auto answer
          </Chip>
          <Chip onClick={() => session.submitAnswer("Yes.")}>short answer</Chip>
        </Section>
      </div>
    </aside>
  );
}

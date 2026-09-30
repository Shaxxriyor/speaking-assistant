import { Button } from "@/components/ui/Button";
import { formatClock } from "./format";

export function PreparationTimer({ remainingMs, totalMs, onSkip }: { remainingMs: number; totalMs: number; onSkip: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <span className="text-slate-300">Preparation time</span>
      <strong className="font-mono text-2xl tabular-nums text-slate-50">{formatClock(remainingMs)}</strong>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-800" aria-hidden>
        <div className="h-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${(remainingMs / totalMs) * 100}%` }} />
      </div>
      <Button onClick={onSkip}>I&apos;m ready</Button>
    </div>
  );
}

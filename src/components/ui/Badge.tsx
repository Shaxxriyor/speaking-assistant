import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "live" | "warn" }) {
  const tones = {
    neutral: "border-slate-700 text-slate-300",
    live: "border-emerald-500/50 text-emerald-300",
    warn: "border-amber-500/50 text-amber-200",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

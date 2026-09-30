import type { ConversationEntry } from "@/types/exam";
import { PHASE_LABEL } from "./format";

export function TranscriptView({ entries }: { entries: readonly ConversationEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className={e.speaker === "examiner" ? "text-slate-400" : "border-l-2 border-emerald-500/60 pl-3 text-slate-100"}>
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/80">
            {e.speaker === "examiner" ? PHASE_LABEL[e.phase] : "You"}
          </span>
          {e.text || <em className="text-slate-500">(no answer)</em>}
        </li>
      ))}
    </ol>
  );
}

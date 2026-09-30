"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatClock } from "./format";

/**
 * Developer stand-in for the candidate's voice: type the answer instead of speaking it.
 * Replaced by microphone + speech recognition in the final integration stage.
 */
export function CandidateInput({ onSubmit, limitMs }: { onSubmit: (text: string) => void; limitMs?: number }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => ref.current?.focus(), []);

  const send = () => {
    onSubmit(text);
    setText("");
  };

  return (
    <form
      className="w-full max-w-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="candidate-answer" className="mb-1.5 flex items-center justify-between text-sm text-slate-400">
        <span>
          Your answer <span className="text-amber-300/90">(developer text input, instead of speech)</span>
        </span>
        {limitMs ? <span className="font-mono tabular-nums">limit {formatClock(limitMs)}</span> : null}
      </label>
      <textarea
        id="candidate-answer"
        ref={ref}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Type what the candidate says, then press Enter…"
        className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onSubmit("")}>
          Skip
        </Button>
        <Button type="submit" variant="primary">
          Answer
        </Button>
      </div>
    </form>
  );
}

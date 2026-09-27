"use client";

import { useWhisperRecorder } from "@/lib/useWhisperRecorder";

const QUESTION = "Let's talk about your hometown. What do you like most about it?";

const LABELS = {
  idle: "Press Start and answer the question",
  listening: "Listening… speak whenever you're ready",
  transcribing: "Transcribing your answer…",
  done: "Here is what you said",
  error: "Something went wrong",
} as const;

export default function Page() {
  const { status, transcript, error, level, start, stop } = useWhisperRecorder({ maxDurationMs: 60_000 });
  const busy = status === "listening" || status === "transcribing";

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 16px" }}>
      <h1 style={{ fontSize: 22 }}>Whisper transcription test</h1>
      <p style={{ fontSize: 18 }}>{QUESTION}</p>

      <p aria-live="polite">{LABELS[status]}</p>
      <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${Math.round(level * 100)}%`, background: "#34d399", transition: "width 80ms" }} />
      </div>

      {status === "listening" ? (
        <button onClick={stop}>Finish answer</button>
      ) : (
        <button onClick={start} disabled={busy}>
          {status === "idle" ? "Start" : "Answer again"}
        </button>
      )}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {transcript && (
        <blockquote style={{ borderLeft: "3px solid #34d399", margin: "16px 0", paddingLeft: 12 }}>{transcript}</blockquote>
      )}
    </main>
  );
}

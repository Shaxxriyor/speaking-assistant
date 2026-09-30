"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExaminerAvatar, type AvatarMode } from "@/components/ExaminerAvatar";
import { examiner, examScript, type CueCard } from "@/lib/examScript";
import { useExaminerVoice } from "@/lib/useExaminerVoice";
import { useWhisperRecorder } from "@/lib/useWhisperRecorder";

type Phase = "welcome" | "running" | "finished";

interface Answer {
  part: number;
  question: string;
  answer: string;
}

const PART_LABEL = ["Introduction", "Part 1", "Part 2", "Part 3"];

function formatTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ExamPage() {
  const voice = useExaminerVoice();
  const recorder = useWhisperRecorder();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [part, setPart] = useState(0);
  const [caption, setCaption] = useState("");
  const [showCaptions, setShowCaptions] = useState(true);
  const [card, setCard] = useState<CueCard | null>(null);
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [answerLimit, setAnswerLimit] = useState(0);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const cancelledRef = useRef(false);
  const prepDoneRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<((choice: "retry" | "skip") => void) | null>(null);

  useEffect(
    () => () => {
      cancelledRef.current = true;
    },
    [],
  );

  const prepare = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const endsAt = Date.now() + ms;
      setPrepLeft(ms);
      const timer = setInterval(() => {
        const left = endsAt - Date.now();
        setPrepLeft(left);
        if (left <= 0) finish();
      }, 250);
      function finish() {
        clearInterval(timer);
        prepDoneRef.current = null;
        setPrepLeft(null);
        resolve();
      }
      prepDoneRef.current = finish;
    });
  }, []);

  const askRetry = useCallback(() => {
    setNeedsRetry(true);
    return new Promise<"retry" | "skip">((resolve) => {
      retryRef.current = (choice) => {
        retryRef.current = null;
        setNeedsRetry(false);
        resolve(choice);
      };
    });
  }, []);

  const runExam = useCallback(async () => {
    for (let i = 0; i < examScript.length; i++) {
      if (cancelledRef.current) return;
      const step = examScript[i];
      const next = examScript[i + 1];
      if (next) void voice.prefetch(next.say);

      setPart(step.part);
      setCaption(step.say);
      setCard(step.cueCard ?? (step.part === 2 ? (c) => c : null));
      await voice.say(step.say);
      if (cancelledRef.current) return;

      if (step.prepMs) await prepare(step.prepMs);

      if (step.answer) {
        setAnswerLimit(step.answer.maxMs);
        let text: string | null = null;
        while (text === null) {
          text = await recorder.record(step.answer);
          if (cancelledRef.current) return;
          if (text === null && (await askRetry()) === "skip") text = "";
        }
        const answer = text;
        setAnswers((prev) => [...prev, { part: step.part, question: step.say, answer }]);
      }
    }
    setCard(null);
    setPhase("finished");
  }, [askRetry, prepare, recorder, voice]);

  const start = () => {
    voice.unlock();
    void voice.prefetch(examScript[0].say);
    cancelledRef.current = false;
    setAnswers([]);
    setPhase("running");
    void runExam();
  };

  const mode: AvatarMode = voice.speaking
    ? "speaking"
    : recorder.status === "listening"
      ? "listening"
      : recorder.status === "transcribing"
        ? "thinking"
        : "idle";

  return (
    <main className="exam">
      <header className="exam__top">
        <span className="exam__brand">IELTS Speaking</span>
        {phase === "running" && <span className="exam__part">{PART_LABEL[part]}</span>}
        {phase !== "welcome" && (
          <label className="exam__toggle">
            <input type="checkbox" checked={showCaptions} onChange={(e) => setShowCaptions(e.target.checked)} />
            Captions
          </label>
        )}
      </header>

      <ExaminerAvatar
        name={examiner.name}
        title={examiner.title}
        photo={examiner.photo}
        faceData={examiner.faceData}
        idleVideo={examiner.idleVideo}
        talkingVideo={examiner.talkingVideo}
        mode={phase === "running" ? mode : "idle"}
        voiceLevel={voice.level}
      />

      {phase === "welcome" && (
        <section className="panel panel--center">
          <h1>Full IELTS Speaking test</h1>
          <p>About 12 minutes · Parts 1, 2 and 3. Use headphones in a quiet room and allow the microphone when asked.</p>
          <button className="btn btn--primary" onClick={start}>
            Start the test
          </button>
        </section>
      )}

      {phase === "running" && (
        <>
          {showCaptions && caption && <p className="caption">{caption}</p>}

          {card && (
            <section className="cuecard">
              <h2>{card.topic}</h2>
              <p>You should say:</p>
              <ul>
                {card.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {prepLeft !== null && (
            <div className="status">
              <span>Preparation time</span>
              <strong className="status__timer">{formatTime(prepLeft)}</strong>
              <button className="btn" onClick={() => prepDoneRef.current?.()}>
                I&apos;m ready
              </button>
            </div>
          )}

          {recorder.status === "listening" && (
            <div className="status status--live">
              <span className="status__mic" aria-hidden>
                ●
              </span>
              <span>Your turn — speak whenever you&apos;re ready</span>
              <span className="meter" aria-hidden>
                <span style={{ width: `${Math.round(recorder.level * 100)}%` }} />
              </span>
              <strong className="status__timer">{formatTime(answerLimit - recorder.elapsedMs)}</strong>
              <button className="btn" onClick={recorder.stop}>
                Finish answer
              </button>
            </div>
          )}

          {recorder.status === "transcribing" && <div className="status">Listening back to your answer…</div>}

          {needsRetry && (
            <div className="alert" role="alert">
              <p>{recorder.error ?? "Something went wrong with the recording."}</p>
              <div>
                <button className="btn" onClick={() => retryRef.current?.("retry")}>
                  Answer again
                </button>
                <button className="btn btn--ghost" onClick={() => retryRef.current?.("skip")}>
                  Skip question
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "finished" && (
        <section className="panel">
          <h1>Test complete</h1>
          <p>Here is what you said. Band-score feedback will appear here next.</p>
          <ol className="transcript">
            {answers.map((a, i) => (
              <li key={i}>
                <span className="transcript__part">{PART_LABEL[a.part]}</span>
                <p className="transcript__q">{a.question}</p>
                <p className="transcript__a">{a.answer || <em>(skipped)</em>}</p>
              </li>
            ))}
          </ol>
          <button className="btn btn--primary" onClick={start}>
            Take the test again
          </button>
        </section>
      )}
    </main>
  );
}

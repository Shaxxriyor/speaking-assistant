"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "listening" | "transcribing" | "done" | "error";

export interface RecordOptions {
  /** Hard cap on answer length, e.g. 120_000 for Part 2. */
  maxDurationMs?: number;
  /** Stop automatically after this much silence once the student has started speaking. 0 disables. */
  silenceMs?: number;
  /** Mic level (0–1 RMS) above which we count the student as speaking. */
  speechThreshold?: number;
  /** false = record but don't send to Whisper (demo mode without an OpenAI key); resolves with "". */
  transcribe?: boolean;
}

// Chrome/Edge/Firefox record webm/opus; Safari/iOS records mp4. Whisper accepts all of these.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionFor(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Records from the microphone with MediaRecorder and sends the audio to /api/transcribe (OpenAI Whisper).
 * Does not use the browser's SpeechRecognition API, so it works in every modern browser, including Safari and Firefox.
 *
 * `record()` resolves with the transcript once the student finishes (silence, time limit or `stop()`),
 * or with null if recording or transcription failed (see `error`).
 */
export function useWhisperRecorder(defaults: RecordOptions = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef = useRef<((text: string | null) => void) | null>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const finish = useCallback((text: string | null) => {
    resolveRef.current?.(text);
    resolveRef.current = null;
  }, []);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      setStatus("error");
      finish(null);
    },
    [finish],
  );

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    rafRef.current = null;
    maxTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const transcribe = useCallback(
    async (blob: Blob, mime: string) => {
      setStatus("transcribing");
      const body = new FormData();
      body.append("audio", new File([blob], `answer.${extensionFor(mime)}`, { type: mime || blob.type }));
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status}).`);
        const text = data.text ?? "";
        setTranscript(text);
        setStatus("done");
        finish(text);
      } catch (e) {
        fail(e instanceof Error ? e.message : "Transcription failed. Please try again.");
      }
    },
    [fail, finish],
  );

  const record = useCallback(
    (options: RecordOptions = {}): Promise<string | null> => {
      const {
        maxDurationMs = 120_000,
        silenceMs = 4_000,
        speechThreshold = 0.04,
        transcribe: shouldTranscribe = true,
      } = { ...defaultsRef.current, ...options };

      // Only one recording at a time: settle any previous caller.
      finish(null);
      const result = new Promise<string | null>((resolve) => {
        resolveRef.current = resolve;
      });
      setError(null);
      setTranscript("");
      setElapsedMs(0);

      void (async () => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          fail("This browser can't record audio. Please update your browser.");
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
        } catch {
          fail("Microphone access was blocked. Allow the microphone in your browser settings and try again.");
          return;
        }
        streamRef.current = stream;

        const mime = pickMimeType();
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          cleanup();
          const type = recorder.mimeType || mime;
          const blob = new Blob(chunks, { type });
          if (blob.size === 0) {
            fail("No audio was recorded. Please try again.");
            return;
          }
          if (!shouldTranscribe) {
            setStatus("done");
            finish("");
            return;
          }
          void transcribe(blob, type);
        };

        // Mic level meter + auto-stop on silence.
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const startedAt = performance.now();
        let heardSpeech = false;
        let lastLoud = startedAt;

        const tick = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const s of samples) sum += s * s;
          const rms = Math.sqrt(sum / samples.length);
          setLevel(Math.min(1, rms * 8));
          const now = performance.now();
          setElapsedMs(now - startedAt);
          if (rms > speechThreshold) {
            heardSpeech = true;
            lastLoud = now;
          } else if (silenceMs > 0 && heardSpeech && now - lastLoud > silenceMs) {
            stop();
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        recorder.start(1000);
        setStatus("listening");
        rafRef.current = requestAnimationFrame(tick);
        maxTimerRef.current = setTimeout(stop, maxDurationMs);
      })();

      return result;
    },
    [cleanup, fail, finish, stop, transcribe],
  );

  /** Stop without transcribing (e.g. when the student leaves the test). */
  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    cleanup();
    finish(null);
    setStatus("idle");
  }, [cleanup, finish]);

  useEffect(() => cancel, [cancel]);

  return { status, transcript, error, level, elapsedMs, record, stop, cancel };
}

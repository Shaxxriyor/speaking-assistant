"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "listening" | "transcribing" | "done" | "error";

export interface RecorderOptions {
  /** Hard cap on answer length, e.g. 120_000 for Part 2. */
  maxDurationMs?: number;
  /** Stop automatically after this much silence once the student has started speaking. 0 disables. */
  silenceMs?: number;
  /** Mic level (0–1) above which we count the student as speaking. */
  speechThreshold?: number;
  onTranscript?: (text: string) => void;
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
 */
export function useWhisperRecorder({
  maxDurationMs = 120_000,
  silenceMs = 4_000,
  speechThreshold = 0.04,
  onTranscript,
}: RecorderOptions = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

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

  const transcribe = useCallback(async (blob: Blob, mime: string) => {
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
      onTranscriptRef.current?.(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed. Please try again.");
      setStatus("error");
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Please update your browser.");
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError("Microphone access was blocked. Allow the microphone in your browser settings and try again.");
      setStatus("error");
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
        setError("No audio was recorded. Please try again.");
        setStatus("error");
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
    let heardSpeech = false;
    let lastLoud = performance.now();

    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      setLevel(Math.min(1, rms * 8));
      const now = performance.now();
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
  }, [cleanup, maxDurationMs, silenceMs, speechThreshold, stop, transcribe]);

  useEffect(() => () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      rec.stop();
    }
    cleanup();
  }, [cleanup]);

  return { status, transcript, error, level, start, stop };
}

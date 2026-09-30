"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 44-byte silent WAV, played inside the Start click so iOS/Safari allow later playback on the same element.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Plays the examiner's lines through /api/speak (OpenAI TTS) and exposes a live voice level (0–1)
 * so the avatar can react while she talks. Call `unlock()` from a click handler before the first `say()`.
 */
export function useExaminerVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cacheRef = useRef(new Map<string, Promise<string | null>>());
  const stopRef = useRef<(() => void) | null>(null);

  const unlock = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    const audio = audioRef.current;
    audio.src = SILENT_WAV;
    audio.play().catch(() => {});

    if (!ctxRef.current) {
      try {
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaElementSource(audio).connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        // Level metering is cosmetic; playback still works without it.
      }
    }
    ctxRef.current?.resume().catch(() => {});
  }, []);

  /** Fetch (and cache) the audio for a line so it plays without delay later. */
  const prefetch = useCallback((text: string) => {
    const cache = cacheRef.current;
    let entry = cache.get(text);
    if (!entry) {
      entry = fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
        .catch(() => null);
      cache.set(text, entry);
      // Don't cache failures, so a retry can succeed.
      void entry.then((url) => {
        if (!url) cache.delete(text);
      });
    }
    return entry;
  }, []);

  const meter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const samples = new Float32Array(analyser.fftSize);
    let smooth = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      const rms = Math.sqrt(sum / samples.length);
      smooth = smooth * 0.6 + Math.min(1, rms * 6) * 0.4;
      setLevel(smooth);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * Speak a line and resolve when it has finished. If the voice is unavailable, waits roughly as long
   * as reading the line would take, so the on-screen caption can carry the test instead.
   */
  const say = useCallback(
    async (text: string): Promise<void> => {
      const url = await prefetch(text);
      const audio = audioRef.current;
      setSpeaking(true);
      try {
        if (!url || !audio) {
          await new Promise((r) => setTimeout(r, Math.min(12_000, 1_500 + text.split(/\s+/).length * 330)));
          return;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            audio.onended = audio.onerror = null;
            stopRef.current = null;
            resolve();
          };
          stopRef.current = () => {
            audio.pause();
            done();
          };
          audio.onended = done;
          audio.onerror = done;
          audio.src = url;
          meter();
          audio.play().catch(done);
        });
      } finally {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setLevel(0);
        setSpeaking(false);
      }
    },
    [meter, prefetch],
  );

  const silence = useCallback(() => stopRef.current?.(), []);

  useEffect(
    () => () => {
      stopRef.current?.();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ctxRef.current?.close().catch(() => {});
      for (const entry of cacheRef.current.values()) void entry.then((url) => url && URL.revokeObjectURL(url));
    },
    [],
  );

  return { speaking, level, unlock, prefetch, say, silence };
}

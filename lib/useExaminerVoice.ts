"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 44-byte silent WAV, played inside the Start click so iOS/Safari allow later playback on the same element.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

// Preferred built-in voices for a British female examiner (Chrome, Edge/Windows, Safari/macOS).
const PREFERRED_VOICES = ["Google UK English Female", "Sonia", "Libby", "Hazel", "Susan", "Serena", "Kate", "Martha"];

function pickVoice(voices: SpeechSynthesisVoice[]) {
  for (const name of PREFERRED_VOICES) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

async function loadVoices(synth: SpeechSynthesis) {
  if (synth.getVoices().length) return synth.getVoices();
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 1500);
    synth.addEventListener("voiceschanged", () => (clearTimeout(t), resolve()), { once: true });
  });
  return synth.getVoices();
}

/**
 * Plays the examiner's lines through /api/speak (OpenAI TTS) and exposes a live voice level (0–1)
 * so the avatar can react while she talks. Call `unlock()` from a click handler before the first `say()`.
 *
 * With `browserVoice` (demo mode, no OpenAI key), or whenever /api/speak fails, she speaks with the
 * browser's built-in voice instead, and her lips follow a simulated speech rhythm.
 */
export function useExaminerVoice({ browserVoice = false }: { browserVoice?: boolean } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const cacheRef = useRef(new Map<string, Promise<string | null>>());
  const stopRef = useRef<(() => void) | null>(null);
  const browserVoiceRef = useRef(browserVoice);
  browserVoiceRef.current = browserVoice;
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);

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

    // iOS only lets speech synthesis start from a tap, so start (silently) now.
    try {
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      window.speechSynthesis.speak(warmup);
    } catch {
      // No speech synthesis: say() falls back to timed captions.
    }
  }, []);

  /** Fetch (and cache) the audio for a line so it plays without delay later. */
  const prefetch = useCallback((text: string) => {
    if (browserVoiceRef.current) return Promise.resolve(null);
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

  /** Speak with the browser's own voice; lips follow a syllable-like rhythm while each sentence plays. */
  const speakWithBrowser = useCallback(async (text: string) => {
    const synth = window.speechSynthesis;
    const voice = pickVoice(await loadVoices(synth));
    // One utterance per sentence: Chrome cuts off long utterances, and it gives natural pauses.
    const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];

    let active = false;
    let bump = 0;
    const started = performance.now();
    const tick = () => {
      const t = (performance.now() - started) / 1000;
      bump *= 0.86;
      const syllable = Math.max(0, Math.sin(t * 2 * Math.PI * 4.3) * 0.65 + Math.sin(t * 2 * Math.PI * 6.8 + 1.3) * 0.35);
      setLevel(active ? 0.16 + 0.34 * syllable + 0.2 * bump : 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(safety);
        stopRef.current = null;
        utterancesRef.current = [];
        resolve();
      };
      // If the browser never reports the end, don't hang the test.
      const safety = setTimeout(done, 4_000 + text.split(/\s+/).length * 700);
      stopRef.current = () => {
        synth.cancel();
        done();
      };
      synth.cancel();
      utterancesRef.current = sentences.map((sentence, i) => {
        const u = new SpeechSynthesisUtterance(sentence);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-GB";
        u.rate = 0.95;
        u.onstart = () => (active = true);
        u.onboundary = () => (bump = 1);
        u.onend = () => {
          active = false;
          if (i === sentences.length - 1) done();
        };
        u.onerror = () => {
          active = false;
          if (i === sentences.length - 1) done();
        };
        return u;
      });
      for (const u of utterancesRef.current) synth.speak(u);
    });
  }, []);

  /**
   * Speak a line and resolve when it has finished: OpenAI voice if available, otherwise the browser's voice,
   * otherwise a pause as long as reading the line would take (the on-screen caption carries the test).
   */
  const say = useCallback(
    async (text: string): Promise<void> => {
      const url = await prefetch(text);
      const audio = audioRef.current;
      setSpeaking(true);
      try {
        if (!url || !audio) {
          const wait = () => new Promise((r) => setTimeout(r, Math.min(12_000, 1_500 + text.split(/\s+/).length * 330)));
          if ("speechSynthesis" in window) await speakWithBrowser(text).catch(wait);
          else await wait();
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
    [meter, prefetch, speakWithBrowser],
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

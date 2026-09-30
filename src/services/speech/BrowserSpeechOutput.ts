import { estimateSpeechMs, type SpeechHooks, type SpeechOutputProvider } from "./SpeechOutputProvider";

// Preferred built-in voices for a British female examiner (Chrome, Edge/Windows, Safari/macOS).
const PREFERRED_VOICES = ["Google UK English Female", "Sonia", "Libby", "Hazel", "Susan", "Serena", "Kate", "Martha"];

function pickVoice(voices: SpeechSynthesisVoice[]) {
  for (const name of PREFERRED_VOICES) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "en-GB") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

/** The browser's built-in text-to-speech. Free and offline-capable; quality depends on the installed voices. */
export class BrowserSpeechOutput implements SpeechOutputProvider {
  readonly name = "browser";
  private voice: SpeechSynthesisVoice | null = null;
  private finish: (() => void) | null = null;
  // Chrome garbage-collects utterances that aren't referenced, and then never fires their events.
  private utterances: SpeechSynthesisUtterance[] = [];

  static isSupported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  unlock() {
    try {
      const warmup = new SpeechSynthesisUtterance(" ");
      warmup.volume = 0;
      speechSynthesis.speak(warmup);
    } catch {
      // Not available: speak() will still resolve via its safety timeout.
    }
  }

  private async loadVoice() {
    if (this.voice) return this.voice;
    let voices = speechSynthesis.getVoices();
    if (!voices.length) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 1500);
        speechSynthesis.addEventListener("voiceschanged", () => (clearTimeout(t), resolve()), { once: true });
      });
      voices = speechSynthesis.getVoices();
    }
    this.voice = pickVoice(voices);
    return this.voice;
  }

  async speak(text: string, hooks: SpeechHooks = {}, signal?: AbortSignal) {
    const voice = await this.loadVoice();
    // One utterance per sentence: Chrome cuts long utterances off, and it gives natural pauses.
    const sentences: { text: string; offset: number }[] = [];
    for (const m of text.matchAll(/[^.!?]+[.!?]*/g)) if (m[0].trim()) sentences.push({ text: m[0], offset: m.index ?? 0 });
    if (!sentences.length) sentences.push({ text, offset: 0 });

    await new Promise<void>((resolve) => {
      let done = false;
      const safety = setTimeout(() => this.finish?.(), estimateSpeechMs(text) * 2 + 3000);
      const onAbort = () => this.cancel();
      this.finish = () => {
        if (done) return;
        done = true;
        clearTimeout(safety);
        signal?.removeEventListener("abort", onAbort);
        this.utterances = [];
        this.finish = null;
        hooks.onEnd?.();
        resolve();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      speechSynthesis.cancel();
      this.utterances = sentences.map((s, i) => {
        const u = new SpeechSynthesisUtterance(s.text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-GB";
        u.rate = 0.95;
        if (i === 0) u.onstart = () => hooks.onStart?.();
        u.onboundary = (e) => hooks.onBoundary?.(s.offset + e.charIndex);
        if (i === sentences.length - 1) u.onend = u.onerror = () => this.finish?.();
        return u;
      });
      for (const u of this.utterances) speechSynthesis.speak(u);
    });
  }

  cancel() {
    try {
      speechSynthesis.cancel();
    } finally {
      this.finish?.();
    }
  }
}

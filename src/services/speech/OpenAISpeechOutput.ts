import type { SpeechHooks, SpeechOutputProvider } from "./SpeechOutputProvider";

// 44-byte silent WAV, played inside the first click so iOS/Safari allow later playback on the same element.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Natural examiner voice via /api/speak (OpenAI text-to-speech), with live loudness for lip sync. */
export class OpenAISpeechOutput implements SpeechOutputProvider {
  readonly name = "openai";
  private audio: HTMLAudioElement | null = null;
  private analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;
  private cache = new Map<string, Promise<string>>();
  private finish: (() => void) | null = null;

  unlock() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      try {
        this.ctx = new AudioContext();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.ctx.createMediaElementSource(this.audio).connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch {
        this.analyser = null; // metering is optional
      }
    }
    this.audio.src = SILENT_WAV;
    this.audio.play().catch(() => {});
    this.ctx?.resume().catch(() => {});
  }

  prefetch(text: string) {
    void this.load(text).catch(() => {});
  }

  private load(text: string) {
    let entry = this.cache.get(text);
    if (!entry) {
      entry = fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(`Voice unavailable (${res.status})`);
        return URL.createObjectURL(await res.blob());
      });
      entry.catch(() => this.cache.delete(text));
      this.cache.set(text, entry);
    }
    return entry;
  }

  async speak(text: string, hooks: SpeechHooks = {}, signal?: AbortSignal) {
    if (!this.audio) this.unlock();
    const url = await this.load(text);
    const audio = this.audio!;
    await new Promise<void>((resolve, reject) => {
      let raf = 0;
      const samples = this.analyser ? new Float32Array(this.analyser.fftSize) : null;
      const meter = () => {
        if (this.analyser && samples) {
          this.analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (const s of samples) sum += s * s;
          hooks.onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 6));
        }
        raf = requestAnimationFrame(meter);
      };
      const onAbort = () => this.cancel();
      this.finish = () => {
        cancelAnimationFrame(raf);
        audio.onended = audio.onerror = null;
        signal?.removeEventListener("abort", onAbort);
        this.finish = null;
        hooks.onEnd?.();
        resolve();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      audio.onended = () => this.finish?.();
      audio.onerror = () => {
        this.finish?.();
      };
      audio.src = url;
      audio
        .play()
        .then(() => {
          hooks.onStart?.();
          raf = requestAnimationFrame(meter);
        })
        .catch((e) => {
          cancelAnimationFrame(raf);
          signal?.removeEventListener("abort", onAbort);
          this.finish = null;
          reject(e);
        });
    });
  }

  cancel() {
    this.audio?.pause();
    this.finish?.();
  }
}

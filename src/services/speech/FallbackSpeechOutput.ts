import type { SpeechHooks, SpeechOutputProvider } from "./SpeechOutputProvider";

/** Tries the primary voice; if a line fails (network, quota, autoplay), speaks it with the fallback instead. */
export class FallbackSpeechOutput implements SpeechOutputProvider {
  readonly name: string;

  constructor(
    private readonly primary: SpeechOutputProvider,
    private readonly fallback: SpeechOutputProvider,
  ) {
    this.name = `${primary.name}+${fallback.name}`;
  }

  unlock() {
    this.primary.unlock?.();
    this.fallback.unlock?.();
  }

  prefetch(text: string) {
    this.primary.prefetch?.(text);
  }

  async speak(text: string, hooks?: SpeechHooks, signal?: AbortSignal) {
    try {
      await this.primary.speak(text, hooks, signal);
    } catch (e) {
      if (signal?.aborted) return;
      console.warn(`Voice "${this.primary.name}" failed, using "${this.fallback.name}":`, e);
      await this.fallback.speak(text, hooks, signal);
    }
  }

  cancel() {
    this.primary.cancel();
    this.fallback.cancel();
  }
}

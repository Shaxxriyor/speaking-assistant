import { estimateSpeechMs, type SpeechHooks, type SpeechOutputProvider } from "./SpeechOutputProvider";

/** No audio: "speaks" for roughly as long as the line would take. Used in tests and where no voice is available. */
export class SilentSpeechOutput implements SpeechOutputProvider {
  readonly name = "silent";
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finish: (() => void) | null = null;

  constructor(private readonly durationMs: (text: string) => number = estimateSpeechMs) {}

  speak(text: string, hooks: SpeechHooks = {}, signal?: AbortSignal) {
    return new Promise<void>((resolve) => {
      hooks.onStart?.();
      this.finish = () => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.finish = null;
        signal?.removeEventListener("abort", this.cancelBound);
        hooks.onEnd?.();
        resolve();
      };
      signal?.addEventListener("abort", this.cancelBound, { once: true });
      this.timer = setTimeout(() => this.finish?.(), this.durationMs(text));
    });
  }

  private cancelBound = () => this.cancel();

  cancel() {
    this.finish?.();
  }
}

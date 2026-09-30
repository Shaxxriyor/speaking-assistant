import { TranscriptionAbortedError, type SpeechInputProvider, type TranscribeOptions } from "./SpeechInputProvider";

type Listener = (waiting: boolean) => void;

/**
 * Development stand-in for speech recognition: `transcribe()` waits until the developer submits a typed answer.
 * Optionally answers automatically (tests, unattended demos).
 */
export class MockSpeechInputProvider implements SpeechInputProvider {
  private pending: { resolve: (text: string) => void; cleanup: () => void } | null = null;
  private listeners = new Set<Listener>();

  constructor(private readonly autoAnswer?: (options: TranscribeOptions) => string) {}

  get isWaiting() {
    return this.pending !== null;
  }

  /** Notified when an answer starts/stops being awaited (to show or hide the developer input). */
  onWaitingChange(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.isWaiting);
  }

  transcribe(options: TranscribeOptions = {}): Promise<string> {
    if (this.autoAnswer) return Promise.resolve(this.autoAnswer(options));
    this.pending?.cleanup();
    return new Promise<string>((resolve, reject) => {
      const onAbort = () => {
        cleanup();
        reject(new TranscriptionAbortedError());
      };
      const cleanup = () => {
        options.signal?.removeEventListener("abort", onAbort);
        this.pending = null;
        this.emit();
      };
      if (options.signal?.aborted) return onAbort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      this.pending = {
        resolve: (text) => {
          cleanup();
          resolve(text);
        },
        cleanup,
      };
      this.emit();
    });
  }

  /** Deliver the typed answer. Returns false if no answer was being awaited. */
  submit(text: string): boolean {
    if (!this.pending) return false;
    this.pending.resolve(text.trim());
    return true;
  }
}

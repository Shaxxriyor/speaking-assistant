/** Callbacks a voice reports while speaking; used to drive lip sync. */
export interface SpeechHooks {
  onStart?(): void;
  /** Reached character `charIndex` of the full text (word boundaries, where the voice supports it). */
  onBoundary?(charIndex: number): void;
  /** Live loudness 0 … 1 (audio-based voices only). */
  onLevel?(level: number): void;
  onEnd?(): void;
}

/** The examiner's voice. */
export interface SpeechOutputProvider {
  readonly name: string;
  /** Call from a user gesture (click) before the first `speak()`; browsers block audio otherwise. */
  unlock?(): void;
  /** Warm up a line that will be spoken soon (e.g. fetch its audio). */
  prefetch?(text: string): void;
  speak(text: string, hooks?: SpeechHooks, signal?: AbortSignal): Promise<void>;
  cancel(): void;
}

/** Rough speaking time for a line, used for timeouts and silent playback. */
export const estimateSpeechMs = (text: string) => 600 + text.split(/\s+/).length * 330;

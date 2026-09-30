export interface TranscribeOptions {
  /** The examiner stops the candidate after this long. */
  maxDurationMs?: number;
  signal?: AbortSignal;
}

/**
 * Source of the candidate's answers. The exam engine only knows this interface, so the developer text input
 * (MockSpeechInputProvider) can later be replaced by microphone + Whisper (OpenAITranscriptionProvider).
 */
export interface SpeechInputProvider {
  /** Resolves with the candidate's answer as text once they have finished speaking. */
  transcribe(options?: TranscribeOptions): Promise<string>;
}

export class TranscriptionAbortedError extends Error {
  constructor() {
    super("Transcription aborted");
    this.name = "TranscriptionAbortedError";
  }
}

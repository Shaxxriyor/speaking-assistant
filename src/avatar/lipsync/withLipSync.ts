import type { SpeechHooks, SpeechOutputProvider } from "@/services/speech/SpeechOutputProvider";
import type { LipSyncEngine } from "./LipSyncEngine";

/** Wraps a voice so everything it says drives the avatar's lips (text timeline + boundaries + live loudness). */
export function withLipSync(output: SpeechOutputProvider, lipSync: LipSyncEngine): SpeechOutputProvider {
  return {
    name: output.name,
    unlock: () => output.unlock?.(),
    prefetch: (text) => output.prefetch?.(text),
    cancel: () => output.cancel(),
    async speak(text: string, hooks: SpeechHooks = {}, signal?: AbortSignal) {
      let started = false;
      const begin = () => {
        if (!started) lipSync.begin(text);
        started = true;
      };
      try {
        await output.speak(
          text,
          {
            onStart: () => (begin(), hooks.onStart?.()),
            onBoundary: (i) => (begin(), lipSync.boundary(i), hooks.onBoundary?.(i)),
            onLevel: (l) => (begin(), lipSync.pushLevel(l), hooks.onLevel?.(l)),
            onEnd: () => hooks.onEnd?.(),
          },
          signal,
        );
      } finally {
        lipSync.end();
      }
    },
  };
}

import { BrowserSpeechOutput } from "./BrowserSpeechOutput";
import { FallbackSpeechOutput } from "./FallbackSpeechOutput";
import { OpenAISpeechOutput } from "./OpenAISpeechOutput";
import { SilentSpeechOutput } from "./SilentSpeechOutput";
import type { SpeechOutputProvider } from "./SpeechOutputProvider";

/** Best available voice: OpenAI when the server has a key, otherwise the browser's voice, otherwise silent. */
export function createSpeechOutput({ openai }: { openai: boolean }): SpeechOutputProvider {
  const local: SpeechOutputProvider = BrowserSpeechOutput.isSupported() ? new BrowserSpeechOutput() : new SilentSpeechOutput();
  return openai ? new FallbackSpeechOutput(new OpenAISpeechOutput(), local) : local;
}

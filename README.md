# IELTS Speaking Assistant — Whisper transcription

Speech-to-text uses **OpenAI Whisper** on the server. It does not use the browser's `SpeechRecognition` API,
so it works in Chrome, Edge, Safari (incl. iPhone) and Firefox.

## How it works

1. `lib/useWhisperRecorder.ts` records the microphone with `MediaRecorder`, shows a mic level, and stops
   automatically after 4 s of silence (or at the time limit, e.g. 2 min for Part 2).
2. The audio is uploaded to `app/api/transcribe/route.ts`.
3. The route sends it to OpenAI (`whisper-1`, English) and returns `{ text }`. The API key stays on the server.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your OPENAI_API_KEY
npm run dev                  # open http://localhost:3000
```

## Using it in the examiner app

Replace the old browser speech-recognition code with the hook:

```tsx
const { status, transcript, error, level, start, stop } = useWhisperRecorder({
  maxDurationMs: 120_000, // Part 2: 2 minutes
  silenceMs: 4_000,       // auto-finish after 4 s of silence
  onTranscript: (text) => sendToExaminer(text),
});
```

Cost: `whisper-1` is about $0.006 per minute of audio (a full 12-minute mock ≈ $0.04).

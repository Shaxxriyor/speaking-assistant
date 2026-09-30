# IELTS Speaking Assistant

A full IELTS Speaking mock test (Introduction, Part 1, Part 2 cue card with 1-minute preparation, Part 3)
run by **Muslima**, a realistic examiner who speaks with a natural voice and listens to the student.

## The examiner

- **Voice:** `app/api/speak/route.ts` uses OpenAI TTS (`gpt-4o-mini-tts`, voice `coral`) with a calm,
  neutral British examiner delivery. The next question is fetched while the student is answering, so there is no pause.
- **Face:** `components/ExaminerAvatar.tsx` uses the best media found in `public/examiner/`:
  1. `idle.mp4` + `talking.mp4` — short video loops, cross-faded when she starts/stops talking (most realistic)
  2. `photo.jpg` — the portrait with natural breathing, head movement and a nod while speaking
  3. a silhouette if neither exists
- **Questions:** edit `lib/examScript.ts`.

## Speech-to-text (Whisper)

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

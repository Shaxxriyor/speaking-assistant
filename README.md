# IELTS Speaking Assistant

A full IELTS Speaking mock test (Introduction, Part 1, Part 2 cue card with 1-minute preparation, Part 3)
run by **Muslima**, a realistic examiner who speaks with a natural voice and listens to the student.

## The examiner

- **Voice:** `app/api/speak/route.ts` uses OpenAI TTS (`gpt-4o-mini-tts`, voice `coral`) with a calm,
  neutral British examiner delivery. The next question is fetched while the student is answering, so there is no pause.
- **Room:** she sits behind the desk in an IELTS exam room, seen from the candidate's chair. Her lips, blinks and head
  move while the room stays still and the desk hides her lower body. Built by `scripts/compose_scene.py` from the room
  image and her photo into `room.jpg`, `person.png`, `scene.json` and `scene.jpg`; rerun it if either image changes.
- **Face:** without the room, `components/ExaminerAvatar.tsx` uses the best media found in `public/examiner/`:
  1. `idle.mp4` + `talking.mp4` — short video loops, cross-faded when she starts/stops talking (most realistic)
  2. `photo.jpg` + `face.json` — the photo animated live in the browser (WebGL): her lips and jaw open and close
     with every syllable of her voice, she blinks naturally, breathes, moves her head while talking and gives
     small acknowledging nods while the student speaks
  3. `photo.jpg` alone — the portrait with gentle breathing and head movement
  4. a silhouette if nothing exists

  If you change the photo, regenerate `face.json` (eye, lip and chin positions):

  ```bash
  pip install mediapipe
  curl -L -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
  python scripts/face_landmarks.py public/examiner/photo.jpg face_landmarker.task > public/examiner/face.json
  ```
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

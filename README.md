# IELTS Speaking Examiner

A realistic AI IELTS Speaking examiner: the candidate sits in an IELTS exam room and **Muslima**, the examiner,
runs the full test (Introduction, Part 1, Part 2 with cue card and preparation, Part 3) from across the desk.

**Current stage:** application foundation + interactive examiner avatar. There is **no microphone and no speech
recognition yet**. Candidate answers are typed into a developer text input. Speech recognition is the last stage.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # unit tests (exam engine, animation controllers, lip sync)
npm run typecheck
```

Optional: put `OPENAI_API_KEY=` in `.env.local` for her natural voice. Without it she uses the browser's voice.

### Developer panel

Press the **`** key (backquote) or open `/?dev=1`. It drives every avatar system independently: examiner states,
blink, nods and other gestures, gaze targets (candidate / papers / laptop / left / right / up / down), expressions,
writing, speaking a test line, manual sliders for every pose channel, and exam shortcuts (skip preparation, answers).
It also shows the live pose and frame rate.

## Architecture

```
src/
  app/                    Next.js app (page, layout, /api/speak voice, /api/status)
  components/
    exam-room/            ExamRoom screen, useExamSession (composition root), captions, cue card, timers, input
    examiner/             ExaminerView: mounts the avatar renderer on a canvas
    dev/                  Hidden developer panel
    ui/                   Buttons, panels, badges
  avatar/
    engine/               AvatarAnimationEngine: runs controllers each frame → AvatarPose → renderer
    controllers/          Blink, Eye, Gaze, Head, FacialExpression, LipSync, HandGesture, Writing, Posture
    state/                ExaminerState behaviour profiles (where she looks, expression, activity, gestures)
    gestures/             GestureEngine + gesture definitions (nod, brow flash, pen tap, hand raise, …)
    facial/               Expression presets
    gaze/                 Gaze targets in the room
    lipsync/              LipSyncEngine (text visemes + voice boundaries/loudness), voice adapter
    renderer/             AvatarRenderer interface + PhotoRigRenderer (WebGL)
  exam/
    engine/               IELTSExamEngine state machine (IDLE → GREETING → PART_1 → PART_2 → PART_3 → ENDING)
    parts/                Test rules/timings and per-session script selection
    questions/            Question bank (Part 1 topics, Part 2 cue cards with linked Part 3 questions)
  services/
    speech/               SpeechInputProvider (MockSpeechInputProvider now), SpeechOutputProvider (browser/OpenAI voice)
    ai/                   ExaminerAI interface + MockExaminerAI (scripted, follow-ups for short answers)
  types/ utils/ config/
```

**How the pieces talk**

- `IELTSExamEngine` asks `ExaminerAI` for the next turn, speaks it through a `SpeechOutputProvider`, and waits for the
  answer from a `SpeechInputProvider`. It emits events (`phase`, `examinerState`, `examinerSays`, `cueCard`, …) and
  knows nothing about React or the avatar.
- `useExamSession` wires those events to the `AvatarAnimationEngine` (e.g. `examinerState → avatar.setState`) and
  wraps the voice with `withLipSync` so everything she says moves her lips.
- Each frame, the avatar engine runs its controllers in order on a neutral `AvatarPose` (posture → gaze → head →
  eyes → blink → expression → lip sync → hands → writing), applies developer overrides, and calls
  `AvatarRenderer.render(pose)`.

**Swappable parts** (implement the interface, change one line in `useExamSession`):

| Interface | Now | Later |
| --- | --- | --- |
| `SpeechInputProvider` | `MockSpeechInputProvider` (typed answers) | `OpenAITranscriptionProvider` (microphone + Whisper) |
| `ExaminerAI` | `MockExaminerAI` (scripted) | LLM-backed examiner |
| `SpeechOutputProvider` | Browser voice / OpenAI TTS | Any TTS |
| `AvatarRenderer` | `PhotoRigRenderer` (animated reference photo) | 3D / photoreal renderer |

## The examiner rig

`PhotoRigRenderer` animates the reference picture (`public/examiner/room-scene.jpg`) in a single WebGL pass, using
landmarks in `public/examiner/rig.json`: irises (gaze), eyelids (blinks, looking down), brows (raise/furrow), mouth
(smile, lip shape, jaw opening with lip sync), head (turn, nod, tilt), torso (breathing, lean, weight shift) and the
writing hand. Only her regions move; the room stays still.

If the picture changes, rebuild the rig (see the top of `scripts/build_rig.py` for the model downloads):

```bash
python scripts/build_rig.py public/examiner/room-scene.jpg face_landmarker.task hand_landmarker.task > public/examiner/rig.json
```

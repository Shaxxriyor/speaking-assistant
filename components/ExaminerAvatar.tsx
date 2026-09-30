"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TalkingPhoto, type FaceData, type Framing } from "./TalkingPhoto";

export type AvatarMode = "idle" | "speaking" | "listening" | "thinking";

export interface ExaminerScene {
  /** Room without her (with her shadow baked in). */
  background: string;
  /** Her cut-out, same size as the room. */
  person: string;
  /** Landmarks + desk line in room coordinates (scripts/compose_scene.py). */
  data: string;
  /** Still composite used when WebGL is unavailable. */
  still: string;
  framing: Framing;
}

interface Props {
  name: string;
  title: string;
  /** Seat her in an exam room. Takes priority over the videos and the portrait. */
  scene?: ExaminerScene;
  photo?: string;
  /** Landmarks for the photo (scripts/face_landmarks.py); enables real lip movement and blinking. */
  faceData?: string;
  idleVideo?: string;
  talkingVideo?: string;
  mode: AvatarMode;
  /** Examiner voice level (0–1) while speaking. */
  voiceLevel?: number;
}

type Media = "room" | "room-still" | "video" | "live" | "photo" | "silhouette";

/**
 * The examiner's face. Uses the best media available in public/examiner/:
 *  1. idle.mp4 + talking.mp4 — real video loops, cross-faded as she starts/stops talking (most realistic)
 *  2. photo.jpg + face.json — the photo animated live in WebGL: lips and jaw move with her voice, real blinks,
 *     natural head motion and acknowledging nods while the student speaks
 *  3. photo.jpg alone — still portrait with breathing and head movement (CSS)
 *  4. a silhouette if nothing exists
 */
export function ExaminerAvatar({ name, title, scene, photo, faceData, idleVideo, talkingVideo, mode, voiceLevel = 0 }: Props) {
  const [media, setMedia] = useState<Media | null>(null);
  const [face, setFace] = useState<FaceData | null>(null);
  const [sceneFace, setSceneFace] = useState<FaceData | null>(null);
  const idleRef = useRef<HTMLVideoElement>(null);
  const talkRef = useRef<HTMLVideoElement>(null);
  const speaking = mode === "speaking";

  const videoFailed = () => setMedia(photo ? (face ? "live" : "photo") : "silhouette");
  const liveFailed = useCallback(() => setMedia("photo"), []);
  const roomFailed = useCallback(() => setMedia("room-still"), []);

  // Pick the best media that actually exists. Probing after mount (rather than relying on onError alone)
  // matters because a missing file can fail before React has attached its error handlers.
  useEffect(() => {
    let alive = true;
    const exists = (url?: string) =>
      url ? fetch(url, { method: "HEAD" }).then((r) => r.ok, () => false) : Promise.resolve(false);
    void (async () => {
      const loadJson = (url?: string): Promise<FaceData | null> =>
        url ? fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
      const [roomData, idle, talk, still, landmarks] = await Promise.all([
        loadJson(scene?.data),
        exists(idleVideo),
        exists(talkingVideo),
        exists(photo),
        loadJson(faceData),
      ]);
      if (!alive) return;
      setFace(landmarks);
      setSceneFace(roomData);
      setMedia(
        roomData ? "room" : idle && talk ? "video" : still ? (landmarks ? "live" : "photo") : "silhouette",
      );
    })();
    return () => {
      alive = false;
    };
  }, [scene?.data, idleVideo, talkingVideo, photo, faceData]);

  // Restart the talking loop from the top each time she starts speaking, so mouth motion lines up with speech onset.
  useEffect(() => {
    if (media !== "video") return;
    const talk = talkRef.current;
    if (!talk) return;
    if (speaking) {
      talk.currentTime = 0;
      talk.play().catch(() => {});
    } else {
      talk.pause();
    }
  }, [media, speaking]);

  return (
    <figure className={`avatar avatar--${mode}${scene ? " avatar--room" : ""}`} style={{ "--voice": voiceLevel.toFixed(3) } as React.CSSProperties}>
      <div className="avatar__stage">
        {media === "video" && (
          <>
            <video ref={idleRef} className="avatar__media" src={idleVideo} autoPlay loop muted playsInline onError={videoFailed} />
            <video
              ref={talkRef}
              className="avatar__media avatar__talking"
              style={{ opacity: speaking ? 1 : 0 }}
              src={talkingVideo}
              loop
              muted
              playsInline
              preload="auto"
              onError={videoFailed}
            />
          </>
        )}

        {media === "room" && scene && sceneFace && (
          <TalkingPhoto
            src={scene.person}
            background={scene.background}
            face={sceneFace}
            framing={scene.framing}
            alt={`${name}, ${title}, seated in the exam room`}
            mode={mode}
            voiceLevel={voiceLevel}
            onUnsupported={roomFailed}
          />
        )}

        {media === "room-still" && scene && (
          <img className="avatar__media avatar__still" src={scene.still} alt={`${name}, ${title}, seated in the exam room`} />
        )}

        {media === "live" && photo && face && (
          <TalkingPhoto src={photo} face={face} alt={`${name}, ${title}`} mode={mode} voiceLevel={voiceLevel} onUnsupported={liveFailed} />
        )}

        {media === "photo" && (
          <img className="avatar__media avatar__photo" src={photo} alt={`${name}, ${title}`} onError={() => setMedia("silhouette")} />
        )}

        {media === "silhouette" && (
          <svg className="avatar__media" viewBox="0 0 400 500" role="img" aria-label={`${name}, ${title}`}>
            <defs>
              <radialGradient id="bg" cx="50%" cy="35%" r="75%">
                <stop offset="0" stopColor="#e9ecf5" />
                <stop offset="1" stopColor="#b9c0d4" />
              </radialGradient>
            </defs>
            <rect width="400" height="500" fill="url(#bg)" />
            <ellipse cx="200" cy="190" rx="95" ry="120" fill="#1f2430" />
            <path d="M60 500c10-110 70-170 140-170s130 60 140 170z" fill="#1f2430" />
          </svg>
        )}

        <div className="avatar__glow" aria-hidden />
      </div>

      <figcaption className="avatar__caption">
        <div>
          <strong>{name}</strong>
          <span>{title}</span>
        </div>
        <span className="avatar__bars" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ transform: `scaleY(${speaking ? 0.25 + voiceLevel * (0.6 + ((i * 7) % 5) / 6) : 0.2})` }} />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

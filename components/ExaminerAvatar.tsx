"use client";

import { useEffect, useRef, useState } from "react";

export type AvatarMode = "idle" | "speaking" | "listening" | "thinking";

interface Props {
  name: string;
  title: string;
  photo?: string;
  idleVideo?: string;
  talkingVideo?: string;
  mode: AvatarMode;
  /** Examiner voice level (0–1) while speaking. */
  voiceLevel?: number;
}

type Media = "video" | "photo" | "silhouette";

/**
 * The examiner's face. Uses the best media available in public/examiner/:
 *  1. idle.mp4 + talking.mp4 — real video loops, cross-faded as she starts/stops talking (most realistic)
 *  2. photo.jpg — still portrait with natural breathing, head movement and a voice-reactive glow
 *  3. a silhouette if neither exists
 */
export function ExaminerAvatar({ name, title, photo, idleVideo, talkingVideo, mode, voiceLevel = 0 }: Props) {
  const [media, setMedia] = useState<Media | null>(null);
  const idleRef = useRef<HTMLVideoElement>(null);
  const talkRef = useRef<HTMLVideoElement>(null);
  const speaking = mode === "speaking";

  const videoFailed = () => setMedia(photo ? "photo" : "silhouette");

  // Pick the best media that actually exists. Probing after mount (rather than relying on onError alone)
  // matters because a missing file can fail before React has attached its error handlers.
  useEffect(() => {
    let alive = true;
    const exists = (url?: string) =>
      url ? fetch(url, { method: "HEAD" }).then((r) => r.ok, () => false) : Promise.resolve(false);
    void (async () => {
      const [idle, talk, still] = await Promise.all([exists(idleVideo), exists(talkingVideo), exists(photo)]);
      if (alive) setMedia(idle && talk ? "video" : still ? "photo" : "silhouette");
    })();
    return () => {
      alive = false;
    };
  }, [idleVideo, talkingVideo, photo]);

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
    <figure className={`avatar avatar--${mode}`} style={{ "--voice": voiceLevel.toFixed(3) } as React.CSSProperties}>
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

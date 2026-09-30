"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarAnimationEngine } from "@/avatar/engine/AvatarAnimationEngine";
import { PhotoRigRenderer } from "@/avatar/renderer/PhotoRigRenderer";
import { EXAMINER } from "@/config/examiner";
import type { AvatarRig } from "@/types/rig";

type Status = { kind: "loading" } | { kind: "ready" } | { kind: "fallback"; reason: string };

/** Mounts the avatar renderer on a canvas and lets the animation engine drive it. */
export function ExaminerView({ engine }: { engine: AvatarAnimationEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [stillFailed, setStillFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: PhotoRigRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      try {
        const res = await fetch(EXAMINER.rig);
        if (!res.ok) throw new Error(`Could not load ${EXAMINER.rig} (HTTP ${res.status})`);
        const rig = (await res.json()) as AvatarRig;
        renderer = new PhotoRigRenderer(EXAMINER.image, rig, EXAMINER.framing);
        await renderer.mount(canvas);
        if (disposed) return renderer.dispose();
        const resize = () => renderer?.resize(canvas.clientWidth, canvas.clientHeight, Math.min(2, window.devicePixelRatio || 1));
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();
        engine.setRenderer(renderer);
        engine.start();
        setStatus({ kind: "ready" });
      } catch (e) {
        console.error("Examiner renderer unavailable:", e);
        if (!disposed) setStatus({ kind: "fallback", reason: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      disposed = true;
      engine.stop();
      engine.setRenderer(null);
      observer?.disconnect();
      renderer?.dispose();
    };
  }, [engine]);

  const label = `${EXAMINER.name}, ${EXAMINER.title}, seated at the desk in the exam room`;
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-900 sm:aspect-[16/10]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${status.kind === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {status.kind === "fallback" && !stillFailed && (
        <img
          src={EXAMINER.image}
          alt={label}
          onError={() => setStillFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-[54%_50%]"
        />
      )}
      {status.kind === "fallback" && (
        <div role="alert" className="absolute left-3 right-3 top-3 rounded-lg bg-slate-950/85 px-4 py-3 text-sm text-amber-200 backdrop-blur">
          <p className="font-semibold">
            {stillFailed ? "The examiner picture could not be loaded." : "The examiner is shown without animation."}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-300">{stillFailed ? `${EXAMINER.image} failed to load. ` : ""}{status.reason}</p>
        </div>
      )}
    </div>
  );
}

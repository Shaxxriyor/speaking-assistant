"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarAnimationEngine } from "@/avatar/engine/AvatarAnimationEngine";
import { PhotoRigRenderer } from "@/avatar/renderer/PhotoRigRenderer";
import { EXAMINER } from "@/config/examiner";
import type { AvatarRig } from "@/types/rig";

/** Mounts the avatar renderer on a canvas and lets the animation engine drive it. */
export function ExaminerView({ engine }: { engine: AvatarAnimationEngine }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: PhotoRigRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;

    (async () => {
      try {
        const rig = (await fetch(EXAMINER.rig).then((r) => {
          if (!r.ok) throw new Error(`Rig not found (${r.status})`);
          return r.json();
        })) as AvatarRig;
        renderer = new PhotoRigRenderer(EXAMINER.image, rig, EXAMINER.framing);
        await renderer.mount(canvas);
        if (disposed) return renderer.dispose();
        const resize = () => renderer?.resize(canvas.clientWidth, canvas.clientHeight, Math.min(2, window.devicePixelRatio || 1));
        observer = new ResizeObserver(resize);
        observer.observe(canvas);
        resize();
        engine.setRenderer(renderer);
        engine.start();
        setStatus("ready");
      } catch (e) {
        console.error("Examiner renderer unavailable:", e);
        if (!disposed) setStatus("fallback");
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
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
      />
      {status === "fallback" && (
        <img src={EXAMINER.image} alt={label} className="absolute inset-0 h-full w-full object-cover object-[54%_50%]" />
      )}
    </div>
  );
}

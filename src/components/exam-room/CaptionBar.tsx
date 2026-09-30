/** Subtitles of what the examiner is saying, over the bottom of the scene. */
export function CaptionBar({ text, visible }: { text: string; visible: boolean }) {
  if (!visible || !text) return null;
  return (
    <p aria-live="polite" className="mx-auto max-w-2xl rounded-lg bg-slate-950/75 px-4 py-2 text-center text-base leading-relaxed text-slate-100 backdrop-blur-sm sm:text-lg">
      {text}
    </p>
  );
}

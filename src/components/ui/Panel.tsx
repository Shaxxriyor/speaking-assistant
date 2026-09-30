import type { HTMLAttributes } from "react";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-5 ${className}`} {...props} />;
}

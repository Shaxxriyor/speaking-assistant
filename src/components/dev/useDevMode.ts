"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "examiner-dev-panel";

/** Hidden developer mode: toggle with the backquote key (`), or open with ?dev=1. Remembered per browser. */
export function useDevMode() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let initial = new URLSearchParams(window.location.search).get("dev") === "1";
    try {
      initial ||= localStorage.getItem(KEY) === "1";
    } catch {
      // storage unavailable (private mode): only the URL flag works
    }
    setOpen(initial);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "`" || target?.closest("input, textarea, [contenteditable]")) return;
      setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open]);

  return { open, close: useCallback(() => setOpen(false), []) };
}

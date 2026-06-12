"use client";

import { useCallback, useEffect } from "react";

// A dimmed/blurred popup with a top-left ✕.
//  - busy:  closing is fully blocked (mid-process).
//  - dirty: click-outside / Escape won't close (unsaved work); ✕ still closes.
export default function Modal({ open, busy, dirty, onClose, children }) {
  const closeCasual = useCallback(() => {
    if (!busy && !dirty) onClose();
  }, [busy, dirty, onClose]);

  const closeViaButton = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeCasual();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCasual]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeCasual();
      }}
    >
      <div className="relative my-auto w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <button
          onClick={closeViaButton}
          disabled={busy}
          title={busy ? "Please wait — updating…" : "Close"}
          className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ✕
        </button>
        <div className="p-6 pt-14">{children}</div>
      </div>
    </div>
  );
}

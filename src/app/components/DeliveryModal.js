"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DeliveryFlow from "./DeliveryFlow";

// The single "+ New Delivery" entry point. Opens the delivery flow in a popup.
//  - Closing is blocked while the AI is reading/confirming (busy).
//  - Click-outside / Escape won't close once a note is in progress (dirty),
//    so review work isn't lost by accident. The ✕ still closes (when not busy).
export default function DeliveryModal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

  // Explicit close (the ✕): allowed unless mid-process.
  const closeViaButton = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);

  // Casual close (backdrop / Escape): also blocked once there's unsaved work.
  const closeCasual = useCallback(() => {
    if (!busy && !dirty) setOpen(false);
  }, [busy, dirty]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeCasual();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeCasual]);

  // Lock background scroll while the popup is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset transient state each time the popup opens.
  useEffect(() => {
    if (open) {
      setBusy(false);
      setDirty(false);
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        + New Delivery
      </button>

      {open && (
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
            <div className="p-6 pt-14">
              <DeliveryFlow
                onBusyChange={setBusy}
                onDirtyChange={setDirty}
                onConfirmed={() => router.refresh()}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

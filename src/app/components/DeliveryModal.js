"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import DeliveryFlow from "./DeliveryFlow";

// The single "+ New Delivery" entry point.
export default function DeliveryModal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const router = useRouter();

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

      <Modal open={open} busy={busy} dirty={dirty} onClose={() => setOpen(false)}>
        <DeliveryFlow
          onBusyChange={setBusy}
          onDirtyChange={setDirty}
          onConfirmed={() => router.refresh()}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

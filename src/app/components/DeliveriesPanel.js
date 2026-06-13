"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import DeliveryFlow from "./DeliveryFlow";

// deliveries: [{ id, vendorName, source, status, createdAt (ISO string), itemCount }]
export default function DeliveriesPanel({ deliveries }) {
  const [collapsed, setCollapsed] = useState(false);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (editId != null) {
      setBusy(false);
      setDirty(false);
    }
  }, [editId]);

  async function handleDelete(d) {
    const msg =
      d.status === "confirmed"
        ? "Delete this delivery? Its stock will be reversed (subtracted back out)."
        : "Delete this pending delivery? It was never applied to stock.";
    if (!window.confirm(msg)) return;
    setDeletingId(d.id);
    try {
      const res = await fetch(`/api/deliveries/${d.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete.");
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">🧾 Recent Deliveries</span>
          <span className="text-xs text-zinc-400">· {deliveries.length}</span>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand" : "Collapse"}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/70"
        >
          <span className={`inline-block transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
        </button>
      </div>

      {!collapsed && (
        <>
          {deliveries.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">
              No deliveries yet. Click <strong>+ New Delivery</strong> to scan your first note.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {deliveries.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-zinc-50/60">
                  <div>
                    <span className="font-medium">{d.vendorName || "Unnamed vendor"}</span>
                    <span className="ml-2 text-zinc-500">· {d.itemCount} item(s) · via {d.source}</span>
                    <div className="text-xs text-zinc-400" suppressHydrationWarning>{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    <button
                      onClick={() => setEditId(d.id)}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
                    >
                      {d.status === "pending" ? "Review" : "Edit"}
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      disabled={deletingId === d.id}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === d.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Edit / revisit popup */}
      <Modal open={editId != null} busy={busy} dirty={dirty} onClose={() => setEditId(null)}>
        {editId != null && (
          <DeliveryFlow
            editId={editId}
            onBusyChange={setBusy}
            onDirtyChange={setDirty}
            onConfirmed={() => router.refresh()}
            onClose={() => setEditId(null)}
          />
        )}
      </Modal>
    </section>
  );
}

function StatusBadge({ status }) {
  const map = {
    confirmed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[status] || "bg-zinc-100 text-zinc-600"}`}>{status}</span>;
}

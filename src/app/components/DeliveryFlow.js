"use client";

import { useEffect, useState } from "react";

// The full "new delivery" flow: pick photo -> AI reads it -> review/correct -> confirm.
// Reused inside the dashboard modal and on the /upload page.
//
// Props:
//   onBusyChange(busy)   - true while the AI is reading/confirming (locks the modal)
//   onDirtyChange(dirty) - true once a photo/extraction exists (blocks click-outside close)
//   onConfirmed()        - called after stock is applied (parent can refresh data)
//   onClose()            - called by "Done" (parent closes the modal / navigates)
export default function DeliveryFlow({ editId, onBusyChange, onDirtyChange, onConfirmed, onClose }) {
  const [initializing, setInitializing] = useState(Boolean(editId));
  const [vendorName, setVendorName] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const [delivery, setDelivery] = useState(null);
  const [rows, setRows] = useState([]);

  // Tell the parent when a process is running (locks closing).
  useEffect(() => {
    onBusyChange?.(loading || confirming || initializing);
  }, [loading, confirming, initializing, onBusyChange]);

  // Edit mode: load an existing delivery (reopening reverses it if confirmed).
  useEffect(() => {
    if (!editId) return;
    (async () => {
      setInitializing(true);
      try {
        const res = await fetch(`/api/deliveries/${editId}/reopen`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load this delivery.");
        const d = data.delivery;
        setDelivery(d);
        setPreviewUrl(d.imagePath || null);
        setVendorName(d.vendorName || "");
        setRows(
          d.lines.map((l) => ({
            id: l.id,
            rawText: l.rawText,
            rawName: l.rawName,
            quantity: l.quantity,
            rawUnit: l.rawUnit,
            confidence: l.confidence,
            productId: l.productId ? String(l.productId) : "",
            resolvedQty: l.resolvedQty,
            include: Boolean(l.productId),
          }))
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setInitializing(false);
      }
    })();
  }, [editId]);

  // Tell the parent when there's unsaved work (blocks click-outside close).
  useEffect(() => {
    onDirtyChange?.(Boolean((file || delivery) && !done));
  }, [file, delivery, done, onDirtyChange]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, []);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setDelivery(null);
    setRows([]);
    setDone(false);
    setError("");
  }

  function resolveQty(quantity, unit, product) {
    const qty = Number(quantity) || 0;
    const u = (unit || "").toLowerCase();
    if (product && (u === "crate" || u === "peti" || u === "box")) {
      return Math.round(qty * (product.unitsPerCrate || 1));
    }
    return Math.round(qty);
  }

  async function handleExtract() {
    if (!file) {
      setError("Please choose a photo of the delivery note first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("vendorName", vendorName);
      fd.append("source", "upload");

      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to read the note.");

      setDelivery(data.delivery);
      setRows(
        data.delivery.lines.map((l) => ({
          id: l.id,
          rawText: l.rawText,
          rawName: l.rawName,
          quantity: l.quantity,
          rawUnit: l.rawUnit,
          confidence: l.confidence,
          productId: l.productId ? String(l.productId) : "",
          resolvedQty: l.resolvedQty,
          include: Boolean(l.productId),
        }))
      );
      if (data.delivery.lines.length === 0) {
        setError("The AI couldn't read any items. Try a clearer photo.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(id, changes) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...changes };
        if ("productId" in changes) {
          const product = products.find((p) => String(p.id) === changes.productId);
          next.include = Boolean(changes.productId);
          next.resolvedQty = resolveQty(next.quantity, next.rawUnit, product);
        }
        return next;
      })
    );
  }

  async function handleConfirm() {
    setConfirming(true);
    setError("");
    try {
      const res = await fetch(`/api/deliveries/${delivery.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update inventory.");
      setDone(true);
      onConfirmed?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setFile(null); setPreviewUrl(null); setDelivery(null); setRows([]); setDone(false); setVendorName(""); setError("");
  }

  if (done) {
    const applied = rows.filter((r) => r.include && r.productId);
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h2 className="mt-2 text-xl font-semibold text-emerald-800">Inventory updated!</h2>
        <p className="mt-1 text-sm text-emerald-700">
          Added stock for {applied.length} item(s){vendorName ? ` from ${vendorName}` : ""}.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={() => onClose?.()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Done
          </button>
          <button onClick={reset} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
            Log another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">{editId ? "Edit Delivery" : "New Delivery"}</h2>
        <p className="text-sm text-zinc-500">
          {delivery
            ? "Check the note against the extracted items, then confirm."
            : editId
            ? "Loading this delivery…"
            : "Upload the vendor's handwritten note — the AI will read it."}
        </p>
      </div>

      {editId && !delivery ? (
        <div className="py-10 text-center text-sm text-zinc-400">
          {error ? <span className="text-red-600">{error}</span> : "⏳ Loading delivery…"}
        </div>
      ) : !delivery ? (
        /* ── STEP 1: upload (compact, single column) ── */
        <div className="flex max-w-2xl flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Vendor name (optional)</span>
              <input
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Ramesh Dairy"
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Delivery note photo</span>
              <input type="file" accept="image/*" onChange={onPickFile} className="rounded-md border border-zinc-300 px-3 py-2" />
            </label>
          </div>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="delivery note preview" className="max-h-56 w-auto cursor-zoom-in rounded-lg border border-zinc-200" onClick={() => setZoomed(true)} />
          )}

          <button
            onClick={handleExtract}
            disabled={loading || !file}
            className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "🤖 Reading note…" : "Read note with AI"}
          </button>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>
      ) : (
        /* ── STEP 2: review (note on the left, values on the right) ── */
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left: the note image */}
          <div className="lg:w-72 lg:shrink-0">
            <div className="lg:sticky lg:top-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="delivery note"
                className="w-full cursor-zoom-in rounded-lg border border-zinc-200"
                onClick={() => setZoomed(true)}
              />
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                <span>🔍 Click to enlarge</span>
                {!editId && <button onClick={reset} className="underline hover:text-zinc-600">Use a different note</button>}
              </div>
            </div>
          </div>

          {/* Right: extracted values */}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Review what the AI read</h3>
            <p className="mb-3 text-sm text-zinc-500">Fix any wrong match or quantity, untick to skip, then confirm.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-2">Add?</th>
                    <th className="py-2 pr-2">AI read</th>
                    <th className="py-2 pr-2">Matched product</th>
                    <th className="py-2 pr-2 text-right">Qty</th>
                    <th className="py-2 pr-2">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-100 align-top">
                      <td className="py-3 pr-2">
                        <input type="checkbox" checked={row.include} onChange={(e) => updateRow(row.id, { include: e.target.checked })} />
                      </td>
                      <td className="py-3 pr-2">
                        <div className="font-medium">{row.rawText}</div>
                        <div className="text-xs text-zinc-400">parsed: {row.quantity} {row.rawUnit}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <select
                          value={row.productId}
                          onChange={(e) => updateRow(row.id, { productId: e.target.value })}
                          className={`w-full rounded-md border px-2 py-1.5 ${row.productId ? "border-zinc-300" : "border-red-300 bg-red-50"}`}
                        >
                          <option value="">— No match (skip) —</option>
                          <optgroup label="Daily-vendor items">
                            {products.filter((p) => p.supply === "local_vendor").map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Formal inventory">
                            {products.filter((p) => p.supply !== "local_vendor").map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <input
                          type="number"
                          min="0"
                          value={row.resolvedQty}
                          onChange={(e) => updateRow(row.id, { resolvedQty: Number(e.target.value) })}
                          className="w-16 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
                        />
                      </td>
                      <td className="py-3 pr-2">
                        <ConfidencePill value={row.confidence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {confirming ? "Updating…" : "Confirm & update inventory"}
            </button>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {zoomed && previewUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="delivery note enlarged" className="max-h-[90vh] max-w-[90vw] cursor-zoom-out rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

function ConfidencePill({ value }) {
  if (value == null) return <span className="text-zinc-400">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "bg-emerald-50 text-emerald-700" : pct >= 50 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{pct}%</span>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { rankProducts } from "@/lib/match";

const MAX_MB = 10;
const MAX_PHOTOS = 8;

// The full "new delivery" flow: pick photo(s) -> AI reads -> review/correct -> confirm.
// Reused inside the dashboard modal and on the /upload page.
export default function DeliveryFlow({ editId, onBusyChange, onDirtyChange, onConfirmed, onClose }) {
  const [initializing, setInitializing] = useState(Boolean(editId));
  const [vendorName, setVendorName] = useState("");
  const [photos, setPhotos] = useState([]); // [{ file, url }] in upload mode
  const [editImage, setEditImage] = useState(null); // single saved image in edit mode
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [zoomUrl, setZoomUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [delivery, setDelivery] = useState(null);
  const [rows, setRows] = useState([]);
  const fileInputRef = useRef(null);

  // "Add as new product" inline form state (for an unmatched line).
  const [newProductRow, setNewProductRow] = useState(null);
  const [npForm, setNpForm] = useState({ name: "", unit: "packet", unitsPerCrate: 1, category: "" });

  function onSelectChange(row, value) {
    if (value === "__new__") {
      setNewProductRow(row.id);
      setNpForm({ name: row.rawName || "", unit: row.rawUnit || "packet", unitsPerCrate: 1, category: "" });
    } else {
      if (newProductRow === row.id) setNewProductRow(null);
      updateRow(row.id, { productId: value });
    }
  }

  async function createProduct(row) {
    if (!npForm.name.trim()) {
      setError("Enter a product name.");
      return;
    }
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(npForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create product.");
      setProducts((prev) => (prev.some((p) => p.id === data.product.id) ? prev : [...prev, data.product]));
      setNewProductRow(null);
      updateRow(row.id, { productId: String(data.product.id) });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  const galleryUrls = photos.length ? photos.map((p) => p.url) : editImage ? [editImage] : [];

  useEffect(() => {
    onBusyChange?.(loading || confirming || initializing);
  }, [loading, confirming, initializing, onBusyChange]);

  useEffect(() => {
    onDirtyChange?.(Boolean((photos.length || delivery) && !done));
  }, [photos, delivery, done, onDirtyChange]);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, []);

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
        setEditImage(d.imagePath || null);
        setVendorName(d.vendorName || "");
        setRows(d.lines.map(toRow));
      } catch (err) {
        setError(err.message);
      } finally {
        setInitializing(false);
      }
    })();
  }, [editId]);

  function toRow(l) {
    return {
      id: l.id, rawText: l.rawText, rawName: l.rawName, quantity: l.quantity, rawUnit: l.rawUnit,
      confidence: l.confidence, productId: l.productId ? String(l.productId) : "",
      resolvedQty: l.resolvedQty, include: Boolean(l.productId),
    };
  }

  function selectFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;
    const valid = [];
    let err = "";
    for (const f of incoming) {
      if (!f.type.startsWith("image/")) { err = "Only image files (JPG or PNG) are allowed."; continue; }
      if (f.size > MAX_MB * 1024 * 1024) { err = `"${f.name}" is over ${MAX_MB} MB and was skipped.`; continue; }
      valid.push({ file: f, url: URL.createObjectURL(f) });
    }
    setError(err);
    if (valid.length) {
      setPhotos((prev) => [...prev, ...valid].slice(0, MAX_PHOTOS));
      setDelivery(null);
      setRows([]);
      setDone(false);
    }
  }

  function removePhoto(i) {
    setPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(i, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
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
    if (photos.length === 0) {
      setError("Please add at least one photo of the delivery note.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append("image", p.file));
      fd.append("vendorName", vendorName);
      fd.append("source", "upload");

      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to read the note.");

      setDelivery(data.delivery);
      setRows(data.delivery.lines.map(toRow));
      if (data.delivery.lines.length === 0) {
        setError("The AI couldn't read any items. Try clearer photos.");
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
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]); setEditImage(null); setDelivery(null); setRows([]); setDone(false); setVendorName(""); setError("");
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
          <button onClick={() => onClose?.()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Done</button>
          <button onClick={reset} className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">Log another</button>
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
            ? "Check the notes against the extracted items, then confirm."
            : editId
            ? "Loading this delivery…"
            : "Upload one or more photos of the handwritten note(s) — the AI will read them."}
        </p>
      </div>

      {editId && !delivery ? (
        <div className="py-10 text-center text-sm text-zinc-400">
          {error ? <span className="text-red-600">{error}</span> : "⏳ Loading delivery…"}
        </div>
      ) : !delivery ? (
        /* ── STEP 1: upload (multiple photos) ── */
        <div className="flex max-w-2xl flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Vendor name (optional)</span>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Ramesh Dairy"
              className="rounded-md border border-zinc-300 px-3 py-2 sm:max-w-xs"
            />
          </label>

          <div>
            <span className="text-sm font-medium">Delivery note photo(s)</span>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); selectFiles(e.dataTransfer.files); }}
              className={`mt-1 rounded-xl border-2 border-dashed p-3 transition-colors ${dragOver ? "border-emerald-400 bg-emerald-50" : "border-zinc-300 bg-zinc-50/50"}`}
            >
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => selectFiles(e.target.files)} className="hidden" />
              {photos.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1 rounded-lg py-10 text-center hover:bg-zinc-50"
                >
                  <span className="text-3xl">📷</span>
                  <span className="text-sm font-medium text-zinc-700">Click to upload or drag photos here</span>
                  <span className="text-xs text-zinc-400">JPG or PNG · up to {MAX_MB} MB each · multiple allowed</span>
                </button>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((p, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`photo ${i + 1}`} onClick={() => setZoomUrl(p.url)} className="h-24 w-full cursor-zoom-in rounded-lg border border-zinc-200 bg-white object-cover" />
                        <button onClick={() => removePhoto(i)} title="Remove" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-xs text-white hover:bg-black">×</button>
                      </div>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <button onClick={() => fileInputRef.current?.click()} className="flex h-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 text-xs text-zinc-400 hover:bg-zinc-50">
                        <span className="text-lg">+</span> Add more
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">{photos.length} photo(s) selected</div>
                </div>
              )}
            </div>
          </div>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <button
            onClick={handleExtract}
            disabled={loading || photos.length === 0}
            className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? `🤖 Reading ${photos.length > 1 ? photos.length + " notes" : "note"}…` : "Read note with AI"}
          </button>
        </div>
      ) : (
        /* ── STEP 2: review (notes on the left, values on the right) ── */
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-72 lg:shrink-0">
            <div className="space-y-2 lg:sticky lg:top-0">
              {galleryUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`note ${i + 1}`} onClick={() => setZoomUrl(url)} className="max-h-[40vh] w-full cursor-zoom-in rounded-lg border border-zinc-200 bg-zinc-50 object-contain" />
              ))}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>🔍 Click to enlarge</span>
                {!editId && <button onClick={reset} className="underline hover:text-zinc-600">Start over</button>}
              </div>
            </div>
          </div>

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
                          value={newProductRow === row.id ? "__new__" : row.productId}
                          onChange={(e) => onSelectChange(row, e.target.value)}
                          className={`w-full rounded-md border px-2 py-1.5 ${row.productId || newProductRow === row.id ? "border-zinc-300" : "border-red-300 bg-red-50"}`}
                        >
                          <option value="">— No match (skip) —</option>
                          <option value="__new__">➕ Add as new product…</option>
                          {(() => {
                            const sugg = rankProducts(row.rawName, products, 3);
                            return sugg.length > 0 ? (
                              <optgroup label="Suggestions (did you mean…)">
                                {sugg.map((p) => (
                                  <option key={`s-${p.id}`} value={p.id}>{p.name}</option>
                                ))}
                              </optgroup>
                            ) : null;
                          })()}
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

                        {newProductRow === row.id && (
                          <div className="mt-2 space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                            <input
                              value={npForm.name}
                              onChange={(e) => setNpForm({ ...npForm, name: e.target.value })}
                              placeholder="Product name"
                              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            />
                            <div className="flex gap-1">
                              <input
                                value={npForm.unit}
                                onChange={(e) => setNpForm({ ...npForm, unit: e.target.value })}
                                placeholder="unit (e.g. packet)"
                                className="w-1/2 rounded border border-zinc-300 px-2 py-1 text-xs"
                              />
                              <input
                                type="number"
                                min="1"
                                value={npForm.unitsPerCrate}
                                onChange={(e) => setNpForm({ ...npForm, unitsPerCrate: e.target.value })}
                                title="units per crate"
                                placeholder="per crate"
                                className="w-1/2 rounded border border-zinc-300 px-2 py-1 text-xs"
                              />
                            </div>
                            <input
                              value={npForm.category}
                              onChange={(e) => setNpForm({ ...npForm, category: e.target.value })}
                              placeholder="category (optional)"
                              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => createProduct(row)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700">Create & match</button>
                              <button onClick={() => { setNewProductRow(null); updateRow(row.id, { productId: "" }); }} className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-white">Cancel</button>
                            </div>
                          </div>
                        )}
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
                      <td className="py-3 pr-2"><ConfidencePill value={row.confidence} /></td>
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

      {zoomUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-6" onClick={() => setZoomUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="note enlarged" className="max-h-[90vh] max-w-[90vw] cursor-zoom-out rounded-lg object-contain" />
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

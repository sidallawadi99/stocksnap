"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function UploadPage() {
  const [vendorName, setVendorName] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(false); // AI reading the note
  const [confirming, setConfirming] = useState(false); // applying to stock
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [delivery, setDelivery] = useState(null); // result from /api/extract
  const [rows, setRows] = useState([]); // editable review rows

  // Load the catalogue once, for the product dropdowns.
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

  // Recompute "in base units" when quantity, unit, or product changes.
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
        // If the matched product changed, recompute the converted quantity.
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
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    const applied = rows.filter((r) => r.include && r.productId);
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-2 text-xl font-semibold text-emerald-800">Inventory updated!</h1>
        <p className="mt-1 text-sm text-emerald-700">
          Added stock for {applied.length} product(s) from {vendorName || "this vendor"}.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            View Dashboard
          </Link>
          <button
            onClick={() => {
              setFile(null); setPreviewUrl(null); setDelivery(null); setRows([]); setDone(false); setVendorName("");
            }}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Log another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New Delivery</h1>
        <p className="text-sm text-zinc-500">
          Upload the vendor&apos;s handwritten note (this simulates a photo arriving on WhatsApp). The AI reads it; you review and confirm.
        </p>
      </div>

      {/* Step 1: upload */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
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
          <img src={previewUrl} alt="delivery note preview" className="mt-4 max-h-72 rounded-lg border border-zinc-200" />
        )}

        <button
          onClick={handleExtract}
          disabled={loading || !file}
          className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "🤖 Reading note…" : "Read note with AI"}
        </button>
      </section>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Step 2: review */}
      {delivery && rows.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Review what the AI read</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Fix any wrong match or quantity, untick anything to skip, then confirm. Stock changes only after you confirm.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Add?</th>
                  <th className="py-2 pr-3">AI read</th>
                  <th className="py-2 pr-3">Matched product</th>
                  <th className="py-2 pr-3 text-right">Qty to add</th>
                  <th className="py-2 pr-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 align-top">
                    <td className="py-3 pr-3">
                      <input type="checkbox" checked={row.include} onChange={(e) => updateRow(row.id, { include: e.target.checked })} />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-medium">{row.rawText}</div>
                      <div className="text-xs text-zinc-400">
                        parsed: {row.quantity} {row.rawUnit}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={row.productId}
                        onChange={(e) => updateRow(row.id, { productId: e.target.value })}
                        className={`rounded-md border px-2 py-1.5 ${row.productId ? "border-zinc-300" : "border-red-300 bg-red-50"}`}
                      >
                        <option value="">— No match (skip) —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.resolvedQty}
                        onChange={(e) => updateRow(row.id, { resolvedQty: Number(e.target.value) })}
                        className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-right"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <ConfidencePill value={row.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="mt-5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {confirming ? "Updating…" : "Confirm & update inventory"}
          </button>
        </section>
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

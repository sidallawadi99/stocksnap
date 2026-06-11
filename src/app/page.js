import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Always fetch fresh data so stock changes show up immediately after a delivery.
export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 6;

export default async function Dashboard() {
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  const deliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { lines: true },
  });

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory Dashboard</h1>
          <p className="text-sm text-zinc-500">Live stock, updated from vendor delivery notes.</p>
        </div>
        <Link href="/upload" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          + New Delivery
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Products" value={products.length} />
        <StatCard label="Total units in stock" value={totalUnits} />
        <StatCard label="Low stock items" value={lowStock.length} highlight={lowStock.length > 0} />
        <StatCard label="Deliveries logged" value={deliveries.length} />
      </div>

      {/* Inventory table */}
      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-3 text-sm font-semibold">Catalogue & Stock</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3 text-right">In stock</th>
              <th className="px-5 py-3">Unit</th>
              <th className="px-5 py-3">1 crate =</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const low = p.stock <= LOW_STOCK_THRESHOLD;
              return (
                <tr key={p.id} className="border-t border-zinc-100">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-zinc-500">{p.category}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={low ? "font-semibold text-red-600" : "font-semibold"}>{p.stock}</span>
                    {low && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">low</span>}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{p.unit}</td>
                  <td className="px-5 py-3 text-zinc-500">{p.unitsPerCrate > 1 ? `${p.unitsPerCrate} ${p.unit}s` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Recent deliveries */}
      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-3 text-sm font-semibold">Recent Deliveries</div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            No deliveries yet. Click <strong>+ New Delivery</strong> to scan your first note.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium">{d.vendorName || "Unnamed vendor"}</span>
                  <span className="ml-2 text-zinc-500">· {d.lines.length} item(s) · via {d.source}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span>{new Date(d.createdAt).toLocaleString()}</span>
                  <StatusBadge status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${highlight ? "border-red-200" : "border-zinc-200"}`}>
      <div className={`text-2xl font-semibold ${highlight ? "text-red-600" : ""}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    confirmed: "bg-emerald-50 text-emerald-700",
    pending: "bg-amber-50 text-amber-700",
  };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[status] || "bg-zinc-100 text-zinc-600"}`}>{status}</span>;
}

import { prisma } from "@/lib/prisma";
import ChatPanel from "@/app/components/ChatPanel";

// Always fetch fresh data so stock changes show up immediately after a delivery.
export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 6;
const DAY = 24 * 60 * 60 * 1000;

export default async function Dashboard() {
  const products = await prisma.product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { batches: true },
  });
  const deliveries = await prisma.delivery.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { lines: true },
  });

  // Today's window, in server local time.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY);

  const sumBatches = (p, field) =>
    p.batches.reduce((sum, b) => {
      const d = new Date(b[field]);
      return d >= startOfToday && d < endOfToday ? sum + b.quantity : sum;
    }, 0);

  // Enrich each product with today's expiring + added counts.
  for (const p of products) {
    p._expiringToday = sumBatches(p, "expiresAt");
    p._addedToday = sumBatches(p, "receivedAt");
  }

  const localVendor = products.filter((p) => p.supply === "local_vendor");
  const distributor = products.filter((p) => p.supply !== "local_vendor");
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
  const expiringToday = products.reduce((sum, p) => sum + p._expiringToday, 0);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory Dashboard</h1>
        <div className="text-sm font-medium text-zinc-700">📅 {todayLabel}</div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total SKUs" value={products.length} />
        <StatCard label="Expiring today" value={expiringToday} highlight={expiringToday > 0} />
        <StatCard label="Low stock items" value={lowStock.length} highlight={lowStock.length > 0} />
        <StatCard label="Total units in stock" value={totalUnits} />
      </div>

      {/* Local-vendor items: the focus of this app */}
      <section className="rounded-xl border border-emerald-200 bg-white">
        <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3">
          <span className="text-sm font-semibold">🛵 Daily-Vendor Items</span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">updated from delivery slips</span>
        </div>
        <ProductTable products={localVendor} showCrate showExpiry />
      </section>

      {/* Formal/distributor inventory */}
      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3">
          <span className="text-sm font-semibold">🏭 Formal Inventory</span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">bought via invoices / POs</span>
        </div>
        <ProductTable products={distributor} />
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

      <aside className="lg:shrink-0">
        <div className="lg:sticky lg:top-6">
          <ChatPanel />
        </div>
      </aside>
      </div>
    </div>
  );
}

function ProductTable({ products, showCrate, showExpiry }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-5 py-3">Product</th>
            <th className="px-5 py-3">Brand</th>
            <th className="px-5 py-3">Category</th>
            <th className="px-5 py-3 text-right">In stock</th>
            <th className="px-5 py-3">Unit</th>
            {showCrate && <th className="px-5 py-3">1 crate =</th>}
            {showExpiry && <th className="px-5 py-3 text-right">Expiring today</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const low = p.stock <= LOW_STOCK_THRESHOLD;
            return (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="px-5 py-3 font-medium">{p.name}</td>
                <td className="px-5 py-3 text-zinc-500">{p.brand || "—"}</td>
                <td className="px-5 py-3 text-zinc-500">{p.category}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <span className={low ? "font-semibold text-red-600" : "font-semibold"}>{p.stock}</span>
                  {p._addedToday > 0 && (
                    <span className="ml-1 text-xs font-medium text-emerald-600">(+{p._addedToday})</span>
                  )}
                  {low && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">low</span>}
                </td>
                <td className="px-5 py-3 text-zinc-500">{p.unit}</td>
                {showCrate && (
                  <td className="px-5 py-3 text-zinc-500">{p.unitsPerCrate > 1 ? `${p.unitsPerCrate} ${p.unit}s` : "—"}</td>
                )}
                {showExpiry && (
                  <td className="px-5 py-3 text-right">
                    {p._expiringToday > 0 ? (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {p._expiringToday} {p.unit}{p._expiringToday > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
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

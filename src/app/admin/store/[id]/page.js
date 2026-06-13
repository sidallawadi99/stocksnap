import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import ProductTable from "@/app/components/ProductTable";

export const dynamic = "force-dynamic";
const LOW = 6;
const DAY = 24 * 60 * 60 * 1000;

// Admin-only, read-only view of one store's dashboard.
export default async function AdminStoreView({ params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const { id } = await params;
  const storeId = Number(id);
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) redirect("/admin");

  const products = await prisma.product.findMany({
    where: { storeId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { batches: true },
  });
  const deliveries = await prisma.delivery.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { lines: true },
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY);
  const sum = (p, f) => p.batches.reduce((s, b) => (new Date(b[f]) >= start && new Date(b[f]) < end ? s + b.quantity : s), 0);
  for (const p of products) {
    p._expiringToday = sum(p, "expiresAt");
    p._addedToday = sum(p, "receivedAt");
  }
  const toRow = (p) => ({
    id: p.id, name: p.name, brand: p.brand, category: p.category, unit: p.unit,
    unitsPerCrate: p.unitsPerCrate, stock: p.stock, supply: p.supply,
    expiringToday: p._expiringToday, addedToday: p._addedToday,
  });
  const localRows = products.filter((p) => p.supply === "local_vendor").map(toRow);
  const distRows = products.filter((p) => p.supply !== "local_vendor").map(toRow);

  const totalUnits = products.reduce((a, p) => a + p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= LOW).length;
  const expiringToday = products.reduce((a, p) => a + p._expiringToday, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800">← Back to all stores</Link>
        <h1 className="mt-1 text-2xl font-semibold">{store.name}</h1>
        <p className="text-sm text-zinc-500">Read-only view · {store.username}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total SKUs" value={products.length} />
        <Stat label="Expiring today" value={expiringToday} highlight={expiringToday > 0} />
        <Stat label="Low stock items" value={lowStock} highlight={lowStock > 0} />
        <Stat label="Total units in stock" value={totalUnits} />
      </div>

      <ProductTable title="🛵 Daily-Vendor Items" badge="updated from delivery slips" accent rows={localRows} showCrate showExpiry />
      <ProductTable title="🏭 Formal Inventory" badge="bought via invoices / POs" rows={distRows} />

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-3 text-sm font-semibold">Recent Deliveries</div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">No deliveries yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium">{d.vendorName || "Unnamed vendor"}</span>
                  <span className="ml-2 text-zinc-500">· {d.lines.length} item(s) · via {d.source}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span suppressHydrationWarning>{new Date(d.createdAt).toLocaleString()}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${d.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{d.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${highlight ? "border-red-200" : "border-zinc-200"}`}>
      <div className={`text-2xl font-semibold ${highlight ? "text-red-600" : ""}`}>{value.toLocaleString("en-IN")}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

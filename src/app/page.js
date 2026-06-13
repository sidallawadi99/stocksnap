import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import ChatPanel from "@/app/components/ChatPanel";
import DeliveryModal from "@/app/components/DeliveryModal";
import ProductTable from "@/app/components/ProductTable";
import DeliveriesPanel from "@/app/components/DeliveriesPanel";

// Always fetch fresh data so stock changes show up immediately after a delivery.
export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 6;
const DAY = 24 * 60 * 60 * 1000;

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") redirect("/admin");

  const products = await prisma.product.findMany({
    where: { storeId: session.storeId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { batches: true },
  });
  const deliveries = await prisma.delivery.findMany({
    where: { storeId: session.storeId },
    orderBy: { createdAt: "desc" },
    take: 10,
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

  // Plain, serializable rows for the (client) interactive table.
  const toRow = (p) => ({
    id: p.id, name: p.name, brand: p.brand, category: p.category, unit: p.unit,
    unitsPerCrate: p.unitsPerCrate, stock: p.stock, supply: p.supply,
    expiringToday: p._expiringToday, addedToday: p._addedToday,
  });
  const localRows = localVendor.map(toRow);
  const distRows = distributor.map(toRow);
  const deliveryRows = deliveries.map((d) => ({
    id: d.id, vendorName: d.vendorName, source: d.source, status: d.status,
    createdAt: d.createdAt.toISOString(), itemCount: d.lines.length,
  }));
  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStock = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
  const expiringToday = products.reduce((sum, p) => sum + p._expiringToday, 0);

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-700">📅 {todayLabel}</div>
        <DeliveryModal />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total SKUs" value={products.length} />
        <StatCard label="Expiring today" value={expiringToday} highlight={expiringToday > 0} />
        <StatCard label="Low stock items" value={lowStock.length} highlight={lowStock.length > 0} />
        <StatCard label="Total units in stock" value={totalUnits} />
      </div>

      {/* Local-vendor items: the focus of this app */}
      <ProductTable title="🛵 Daily-Vendor Items" badge="updated from delivery slips" accent rows={localRows} showCrate showExpiry />

      {/* Formal/distributor inventory */}
      <ProductTable title="🏭 Formal Inventory" badge="bought via invoices / POs" rows={distRows} />

      {/* Recent deliveries (collapsible, editable, deletable) */}
      <DeliveriesPanel deliveries={deliveryRows} />
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

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${highlight ? "border-red-200" : "border-zinc-200"}`}>
      <div className={`text-2xl font-semibold ${highlight ? "text-red-600" : ""}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

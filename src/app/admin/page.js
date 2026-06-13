import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const stores = await prisma.store.findMany({
    orderBy: { id: "asc" },
    include: { deliveries: { include: { lines: true } } },
  });

  const rows = stores.map((s) => {
    const deliveries = s.deliveries;
    const confirmed = deliveries.filter((d) => d.status === "confirmed");
    const lines = confirmed.flatMap((d) => d.lines);
    const total = lines.length;
    const edited = lines.filter((l) => l.edited).length;
    const accuracy = total ? Math.round((1 - edited / total) * 100) : null;
    const confLines = lines.filter((l) => l.confidence != null);
    const avgConf = confLines.length ? Math.round((confLines.reduce((a, l) => a + l.confidence, 0) / confLines.length) * 100) : null;
    const itemsAdded = lines.filter((l) => l.productId).reduce((a, l) => a + l.resolvedQty, 0);
    const lastActive = deliveries.length ? new Date(Math.max(...deliveries.map((d) => new Date(d.createdAt)))) : null;
    return {
      id: s.id, name: s.name, username: s.username,
      deliveries: deliveries.length, confirmed: confirmed.length,
      lines: total, edited, accuracy, avgConf, itemsAdded, lastActive,
    };
  });

  const totalDeliveries = rows.reduce((a, r) => a + r.deliveries, 0);
  const allLines = rows.reduce((a, r) => a + r.lines, 0);
  const allEdited = rows.reduce((a, r) => a + r.edited, 0);
  const overallAccuracy = allLines ? Math.round((1 - allEdited / allLines) * 100) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Store Activity</h1>
        <p className="text-sm text-zinc-500">AI-assisted delivery activity and accuracy across all stores.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Stores" value={stores.length} />
        <StatCard label="Total deliveries" value={totalDeliveries} />
        <StatCard label="Lines processed" value={allLines} />
        <StatCard label="Overall AI accuracy" value={overallAccuracy != null ? `${overallAccuracy}%` : "—"} accent />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-3 text-sm font-semibold">Per-store metrics</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-5 py-3">Store</th>
                <th className="px-5 py-3 text-right">Deliveries</th>
                <th className="px-5 py-3 text-right">Confirmed</th>
                <th className="px-5 py-3 text-right">Lines</th>
                <th className="px-5 py-3 text-right">Items added</th>
                <th className="px-5 py-3 text-right">AI accuracy</th>
                <th className="px-5 py-3 text-right">Avg confidence</th>
                <th className="px-5 py-3">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/store/${r.id}`} className="font-medium text-emerald-700 hover:underline">{r.name}</Link>
                    <div className="text-xs text-zinc-400">{r.username} · view →</div>
                  </td>
                  <td className="px-5 py-3 text-right">{r.deliveries}</td>
                  <td className="px-5 py-3 text-right">{r.confirmed}</td>
                  <td className="px-5 py-3 text-right">{r.lines}</td>
                  <td className="px-5 py-3 text-right">{r.itemsAdded.toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-right">
                    {r.accuracy != null ? <AccuracyPill pct={r.accuracy} /> : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-zinc-600">{r.avgConf != null ? `${r.avgConf}%` : "—"}</td>
                  <td className="px-5 py-3 text-zinc-500" suppressHydrationWarning>
                    {r.lastActive ? r.lastActive.toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-400">
        “AI accuracy” = share of read lines the owner confirmed without editing (the correction rate is the rest).
        It’s the real-world, behavioural measure of extraction quality.
      </p>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${accent ? "border-emerald-200" : "border-zinc-200"}`}>
      <div className={`text-2xl font-semibold ${accent ? "text-emerald-600" : ""}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function AccuracyPill({ pct }) {
  const color = pct >= 90 ? "bg-emerald-50 text-emerald-700" : pct >= 75 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${color}`}>{pct}%</span>;
}

"use client";

import { useMemo, useState } from "react";

const LOW = 6;

// rows: [{ id, name, brand, category, unit, unitsPerCrate, stock, supply, expiringToday, addedToday }]
export default function ProductTable({ title, badge, accent, rows, showCrate, showExpiry }) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort()],
    [rows]
  );

  const visible = useMemo(() => {
    let out = rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (lowOnly && r.stock > LOW) return false;
      if (expiringOnly && !(r.expiringToday > 0)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${r.name} ${r.brand || ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return out;
  }, [rows, query, category, lowOnly, expiringOnly, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const head = accent
    ? "border-emerald-100 bg-emerald-50/60"
    : "border-zinc-100 bg-zinc-50/60";

  return (
    <section className={`rounded-xl border ${accent ? "border-emerald-200" : "border-zinc-200"} bg-white`}>
      {/* Header bar (stays visible when collapsed) */}
      <div className={`flex items-center justify-between gap-2 border-b px-5 py-3 ${head}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className={`rounded px-2 py-0.5 text-xs ${accent ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}>
              {badge}
            </span>
          )}
          <span className="text-xs text-zinc-400">· {rows.length}</span>
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
          {/* Filter toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-2.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or brand…"
              className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
              ))}
            </select>
            <FilterChip active={lowOnly} onClick={() => setLowOnly((v) => !v)} color="red">Low stock</FilterChip>
            {showExpiry && (
              <FilterChip active={expiringOnly} onClick={() => setExpiringOnly((v) => !v)} color="amber">Expiring today</FilterChip>
            )}
            <span className="ml-auto text-xs text-zinc-400">{visible.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>Product</Th>
                  <Th onClick={() => toggleSort("brand")} active={sortKey === "brand"} dir={sortDir}>Brand</Th>
                  <Th onClick={() => toggleSort("category")} active={sortKey === "category"} dir={sortDir}>Category</Th>
                  <Th onClick={() => toggleSort("stock")} active={sortKey === "stock"} dir={sortDir} right>In stock</Th>
                  <th className="px-5 py-3">Unit</th>
                  {showCrate && <th className="px-5 py-3">1 crate =</th>}
                  {showExpiry && (
                    <Th onClick={() => toggleSort("expiringToday")} active={sortKey === "expiringToday"} dir={sortDir} right>Expiring today</Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const low = p.stock <= LOW;
                  return (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="px-5 py-3 font-medium">{p.name}</td>
                      <td className="px-5 py-3 text-zinc-500">{p.brand || "—"}</td>
                      <td className="px-5 py-3 text-zinc-500">{p.category}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <span className={low ? "font-semibold text-red-600" : "font-semibold"}>{p.stock}</span>
                        {p.addedToday > 0 && <span className="ml-1 text-xs font-medium text-emerald-600">(+{p.addedToday})</span>}
                        {low && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-600">low</span>}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{p.unit}</td>
                      {showCrate && (
                        <td className="px-5 py-3 text-zinc-500">{p.unitsPerCrate > 1 ? `${p.unitsPerCrate} ${p.unit}s` : "—"}</td>
                      )}
                      {showExpiry && (
                        <td className="px-5 py-3 text-right">
                          {p.expiringToday > 0 ? (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              {p.expiringToday} {p.unit}{p.expiringToday > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-sm text-zinc-400">No items match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Th({ children, onClick, active, dir, right }) {
  return (
    <th className={`cursor-pointer select-none px-5 py-3 hover:text-zinc-800 ${right ? "text-right" : ""}`} onClick={onClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="text-zinc-400">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </span>
    </th>
  );
}

function FilterChip({ active, onClick, color, children }) {
  const on = color === "red" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700";
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? on : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
    >
      {children}
    </button>
  );
}

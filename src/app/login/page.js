"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      router.replace(data.role === "admin" ? "/admin" : "/");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/jumbotail.png" alt="Jumbotail" width={32} height={32} className="rounded" />
        <span className="text-xl font-semibold">StockSnap</span>
      </div>

      <form onSubmit={handleLogin} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mb-4 text-sm text-zinc-500">to your store dashboard</p>

        <label className="mb-3 block text-sm">
          <span className="font-medium">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="store1"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="••••"
          />
        </label>

        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500">
        <div className="font-medium text-zinc-600">Demo logins</div>
        <div className="mt-1">Store owners: <code>store1</code> … <code>store5</code> · password <code>1234</code></div>
        <div>Admin: <code>admin</code> · password <code>admin</code></div>
      </div>
    </div>
  );
}

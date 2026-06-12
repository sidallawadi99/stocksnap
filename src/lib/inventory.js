import { prisma } from "./prisma";

const DAY = 24 * 60 * 60 * 1000;

// Builds a compact, live text snapshot of inventory for the AI to reason over.
// Shared by the chat assistant and the insights endpoint.
export async function buildInventoryContext() {
  const products = await prisma.product.findMany({
    orderBy: [{ supply: "asc" }, { category: "asc" }, { name: "asc" }],
    include: { batches: true },
  });

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY);
  const sum = (p, field) =>
    p.batches.reduce((s, b) => {
      const d = new Date(b[field]);
      return d >= start && d < end ? s + b.quantity : s;
    }, 0);

  const lines = products.map((p) => {
    const exp = sum(p, "expiresAt");
    const added = sum(p, "receivedAt");
    const tags = [
      `stock ${p.stock} ${p.unit}`,
      p.stock <= 6 ? "LOW" : null,
      exp > 0 ? `expiring today ${exp}` : null,
      added > 0 ? `added today ${added}` : null,
    ].filter(Boolean);
    return `- ${p.name} [${p.category}, ${p.supply}]: ${tags.join(", ")}`;
  });

  return lines.join("\n");
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reverseDelivery } from "@/lib/deliveries";
import { getSession } from "@/lib/auth";

// POST /api/deliveries/:id/reopen
// Prepares a delivery for editing. If it was already confirmed, its stock is
// reversed and it's set back to "pending" so the owner can re-review and
// re-confirm. Returns the delivery with its lines + matched products.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);
    const session = await getSession();
    const existing = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { lines: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
    }
    if (!session || session.role !== "owner" || existing.storeId !== session.storeId) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    if (existing.status === "confirmed") {
      await prisma.$transaction(async (tx) => {
        await reverseDelivery(tx, existing);
        await tx.delivery.update({
          where: { id: deliveryId },
          data: { status: "pending", confirmedAt: null },
        });
        for (const line of existing.lines) {
          await tx.deliveryLine.update({
            where: { id: line.id },
            data: { status: line.productId ? "matched" : "unmatched" },
          });
        }
      });
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { lines: { include: { product: true } } },
    });
    return NextResponse.json({ delivery });
  } catch (err) {
    console.error("reopen delivery error:", err);
    return NextResponse.json({ error: err.message || "Failed to reopen." }, { status: 500 });
  }
}

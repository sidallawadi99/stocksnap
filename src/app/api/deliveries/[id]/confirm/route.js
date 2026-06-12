import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/deliveries/:id/confirm
// The user has reviewed the read lines (and possibly corrected the matched
// product or quantity). Here we APPLY those lines to the inventory: each
// confirmed line adds its quantity to that product's stock.
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);
    const body = await request.json();
    const reviewedLines = body.lines || [];

    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
    }
    if (delivery.status === "confirmed") {
      return NextResponse.json({ error: "This delivery was already confirmed." }, { status: 400 });
    }

    // Run everything as a transaction: either all updates succeed, or none do.
    await prisma.$transaction(async (tx) => {
      for (const line of reviewedLines) {
        const lineId = Number(line.id);
        const productId = line.productId ? Number(line.productId) : null;
        const qty = Math.max(0, Math.round(Number(line.resolvedQty) || 0));
        const include = line.include !== false; // default to true

        // Update the line record to reflect any user corrections.
        await tx.deliveryLine.update({
          where: { id: lineId },
          data: {
            productId,
            resolvedQty: qty,
            status: include && productId ? "confirmed" : "unmatched",
          },
        });

        // Only add to stock if the user kept the line AND it has a product.
        if (include && productId && qty > 0) {
          const product = await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: qty } },
          });

          // Record a batch with its own expiry, for "expiring today" tracking.
          if (product.shelfLifeDays) {
            const DAY = 24 * 60 * 60 * 1000;
            await tx.batch.create({
              data: {
                productId,
                quantity: qty,
                receivedAt: new Date(),
                expiresAt: new Date(Date.now() + product.shelfLifeDays * DAY),
              },
            });
          }
        }
      }

      await tx.delivery.update({
        where: { id: deliveryId },
        data: { status: "confirmed", confirmedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("confirm error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while updating inventory." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyDeliveryToStock } from "@/lib/deliveries";

// POST /api/deliveries/:id/confirm
// The user reviewed the read lines (and possibly corrected product/quantity).
// Apply them to inventory: each confirmed line adds to that product's stock.
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

    await prisma.$transaction((tx) => applyDeliveryToStock(tx, deliveryId, reviewedLines));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("confirm error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while updating inventory." },
      { status: 500 }
    );
  }
}

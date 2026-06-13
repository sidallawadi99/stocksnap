import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reverseDelivery } from "@/lib/deliveries";
import { getSession } from "@/lib/auth";

function ownsOrForbidden(session, delivery) {
  return session && session.role === "owner" && delivery.storeId === session.storeId;
}

// GET /api/deliveries/:id -> a delivery with its lines + matched products.
export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getSession();
  const delivery = await prisma.delivery.findUnique({
    where: { id: Number(id) },
    include: { lines: { include: { product: true } } },
  });
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
  }
  if (!ownsOrForbidden(session, delivery)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  return NextResponse.json({ delivery });
}

// DELETE /api/deliveries/:id -> remove the delivery. If it was confirmed, its
// stock is reversed first so inventory stays correct.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deliveryId = Number(id);
    const session = await getSession();
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { lines: true },
    });
    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found." }, { status: 404 });
    }
    if (!ownsOrForbidden(session, delivery)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      if (delivery.status === "confirmed") {
        await reverseDelivery(tx, delivery);
      }
      await tx.delivery.delete({ where: { id: deliveryId } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete delivery error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete." }, { status: 500 });
  }
}

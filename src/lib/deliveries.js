const DAY = 24 * 60 * 60 * 1000;

// Applies a delivery's reviewed lines to stock: increments each included
// product, creates a dated batch, marks lines + delivery confirmed.
// reviewedLines: [{ id, productId, resolvedQty, include }]. Must run in a tx.
// Returns the applied items [{ name, qty }] (for a confirmation message).
export async function applyDeliveryToStock(tx, deliveryId, reviewedLines) {
  const applied = [];
  for (const line of reviewedLines) {
    const lineId = Number(line.id);
    const productId = line.productId ? Number(line.productId) : null;
    const qty = Math.max(0, Math.round(Number(line.resolvedQty) || 0));
    const include = line.include !== false;

    await tx.deliveryLine.update({
      where: { id: lineId },
      data: { productId, resolvedQty: qty, status: include && productId ? "confirmed" : "unmatched" },
    });

    if (include && productId && qty > 0) {
      const product = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      });
      applied.push({ name: product.name, qty });
      if (product.shelfLifeDays) {
        await tx.batch.create({
          data: {
            productId,
            deliveryId,
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
  return applied;
}

// Reverses the stock effects of a CONFIRMED delivery: subtracts each confirmed
// line's quantity back out (clamped at 0) and removes the batches it created.
// Must be called inside a prisma transaction (`tx`). `delivery.lines` required.
export async function reverseDelivery(tx, delivery) {
  for (const line of delivery.lines) {
    if (line.status === "confirmed" && line.productId && line.resolvedQty > 0) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (product) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: Math.max(0, product.stock - line.resolvedQty) },
        });
      }
    }
  }
  // Remove the batches this delivery created (for expiry/added-today tracking).
  await tx.batch.deleteMany({ where: { deliveryId: delivery.id } });
}

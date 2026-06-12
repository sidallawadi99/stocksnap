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

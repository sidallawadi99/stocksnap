import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { extractDeliveryItems } from "./gemini";
import { findBestProduct, resolveQuantity } from "./match";

// Shared pipeline: takes a delivery-note image, has the AI read it, matches each
// line to the local-vendor catalogue, and saves a PENDING delivery.
// Used by both the web upload (/api/extract) and WhatsApp (/api/whatsapp).
export async function processDeliveryImage({ bytes, mimeType, source = "upload", vendorName = null, sourceRef = null }) {
  const base64 = bytes.toString("base64");

  // Save a copy so the review screen can show the original note.
  const ext = (mimeType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const fileName = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(process.cwd(), "public", "uploads", fileName), bytes);
  const imagePath = `/uploads/${fileName}`;

  // AI reads the note.
  const items = await extractDeliveryItems(base64, mimeType);

  // Match each line to a local-vendor product (slips never contain rice/soap).
  const products = await prisma.product.findMany({ where: { supply: "local_vendor" } });
  const lines = items.map((item) => {
    const { product, score } = findBestProduct(item.name, products);
    const resolvedQty = resolveQuantity(item.quantity, item.unit, product);
    return {
      rawText: item.rawText || `${item.name} ${item.quantity} ${item.unit}`,
      rawName: item.name || "",
      quantity: Number(item.quantity) || 0,
      rawUnit: item.unit || null,
      productId: product ? product.id : null,
      resolvedQty,
      confidence: item.confidence ?? score ?? null,
      status: product ? "matched" : "unmatched",
    };
  });

  return prisma.delivery.create({
    data: { vendorName, source, sourceRef, imagePath, status: "pending", lines: { create: lines } },
    include: { lines: { include: { product: true } } },
  });
}

import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "./prisma";
import { extractDeliveryItems } from "./gemini";
import { findBestProduct, resolveQuantity } from "./match";

// Normalize one photo (auto-rotate via EXIF, downscale, re-encode to JPEG),
// save it, have the AI read it, and match each line to a product.
// Returns { lines, imagePath }.
async function extractLinesFromImage(bytes, mimeType, products) {
  let imageBytes = bytes;
  let outMime = mimeType;
  try {
    imageBytes = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    outMime = "image/jpeg";
  } catch {
    // Not a format sharp can read — fall back to the original bytes.
  }

  const ext = (outMime.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
  const fileName = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(process.cwd(), "public", "uploads", fileName), imageBytes);
  const imagePath = `/uploads/${fileName}`;

  const items = await extractDeliveryItems(imageBytes.toString("base64"), outMime);
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
      // The AI's original guess, for the accuracy/edit-rate metric.
      aiProductId: product ? product.id : null,
      aiResolvedQty: resolvedQty,
    };
  });

  return { lines, imagePath };
}

// Process ONE OR MORE delivery-note photos into a single PENDING delivery
// for a specific store. `images` is an array of { bytes, mimeType }.
export async function processDeliveryImages({ storeId, images, source = "upload", vendorName = null, sourceRef = null }) {
  // Match against THIS store's local-vendor products (slips never contain rice/soap).
  const products = await prisma.product.findMany({ where: { storeId, supply: "local_vendor" } });

  let allLines = [];
  let firstImagePath = null;
  for (const img of images) {
    const { lines, imagePath } = await extractLinesFromImage(img.bytes, img.mimeType, products);
    if (!firstImagePath) firstImagePath = imagePath;
    allLines = allLines.concat(lines);
  }

  return prisma.delivery.create({
    data: { storeId, vendorName, source, sourceRef, imagePath: firstImagePath, status: "pending", lines: { create: allLines } },
    include: { lines: { include: { product: true } } },
  });
}

// Single-image convenience (used by WhatsApp).
export function processDeliveryImage({ storeId, bytes, mimeType, source = "upload", vendorName = null, sourceRef = null }) {
  return processDeliveryImages({ storeId, images: [{ bytes, mimeType }], source, vendorName, sourceRef });
}

import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { extractDeliveryItems } from "@/lib/gemini";
import { findBestProduct, resolveQuantity } from "@/lib/match";

// POST /api/extract
// Receives a delivery photo, reads it with AI, matches each line to the
// catalogue, and saves a PENDING delivery for the user to review.
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    const vendorName = formData.get("vendorName") || null;
    const source = formData.get("source") || "upload";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No image file was provided." }, { status: 400 });
    }
    // Edge: reject non-image uploads (e.g. a PDF or text file).
    if (!file.type || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image (JPG or PNG)." }, { status: 400 });
    }
    // Edge: reject very large files to protect server memory.
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 10 MB)." }, { status: 400 });
    }

    // Read the uploaded file into memory.
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Save a copy so we can show the original note on the review screen.
    // Random suffix avoids collisions when two notes arrive in the same ms.
    const ext = (mimeType.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
    const fileName = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await writeFile(path.join(process.cwd(), "public", "uploads", fileName), bytes);
    const imagePath = `/uploads/${fileName}`;

    // 1) Ask the AI to read the note.
    const items = await extractDeliveryItems(base64, mimeType);

    // 2) Match each read line to a catalogue product.
    //    Handwritten slips only come from local daily vendors, so we match
    //    against just that subset — more accurate, and true to the domain.
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

    // 3) Save the delivery + its lines as PENDING (nothing applied to stock yet).
    const delivery = await prisma.delivery.create({
      data: {
        vendorName,
        source,
        imagePath,
        status: "pending",
        lines: { create: lines },
      },
      include: { lines: { include: { product: true } } },
    });

    return NextResponse.json({ delivery });
  } catch (err) {
    console.error("extract error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while reading the note." },
      { status: 500 }
    );
  }
}

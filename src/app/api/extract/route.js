import { NextResponse } from "next/server";
import { processDeliveryImages } from "@/lib/processNote";
import { getSession } from "@/lib/auth";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image

// POST /api/extract
// Receives one or more delivery photos (web upload), reads them with AI,
// matches lines to the catalogue, and saves a single PENDING delivery.
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "owner") {
      return NextResponse.json({ error: "Please sign in as a store owner." }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("image").filter((f) => f && typeof f !== "string");
    const vendorName = formData.get("vendorName") || null;
    const source = formData.get("source") || "upload";

    if (files.length === 0) {
      return NextResponse.json({ error: "No image was provided." }, { status: 400 });
    }
    for (const file of files) {
      if (!file.type || !file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Please upload images only (JPG or PNG)." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Each image must be under 10 MB." }, { status: 400 });
      }
    }

    const images = [];
    for (const file of files) {
      images.push({ bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type || "image/jpeg" });
    }

    const delivery = await processDeliveryImages({ storeId: session.storeId, images, source, vendorName });
    return NextResponse.json({ delivery });
  } catch (err) {
    console.error("extract error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while reading the note." },
      { status: 500 }
    );
  }
}

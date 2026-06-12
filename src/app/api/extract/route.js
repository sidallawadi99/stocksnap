import { NextResponse } from "next/server";
import { processDeliveryImage } from "@/lib/processNote";

// POST /api/extract
// Receives a delivery photo (web upload), reads it with AI, matches each line
// to the catalogue, and saves a PENDING delivery for the user to review.
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

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";

    const delivery = await processDeliveryImage({ bytes, mimeType, source, vendorName });
    return NextResponse.json({ delivery });
  } catch (err) {
    console.error("extract error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while reading the note." },
      { status: 500 }
    );
  }
}

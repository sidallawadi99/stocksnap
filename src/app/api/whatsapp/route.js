import { prisma } from "@/lib/prisma";
import { processDeliveryImage } from "@/lib/processNote";
import { applyDeliveryToStock } from "@/lib/deliveries";

// Reply to WhatsApp using TwiML (Twilio turns this XML into a message back).
function twiml(message) {
  const safe = String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

const CONFIRM_WORDS = ["confirm", "yes", "y", "ok", "okay", "haan", "ha", "han", "done", "✅"];
const CANCEL_WORDS = ["cancel", "no", "nahi", "discard", "reject", "❌"];

export async function GET() {
  return new Response("StockSnap WhatsApp webhook is live ✅", { status: 200 });
}

// POST /api/whatsapp — Twilio posts here when a WhatsApp message arrives.
export async function POST(request) {
  try {
    const form = await request.formData();
    const numMedia = parseInt(form.get("NumMedia") || "0", 10);
    const profileName = form.get("ProfileName") || null;
    const from = form.get("From") || "";
    const body = (form.get("Body") || "").trim().toLowerCase();

    // ── A photo arrived → read it and create a PENDING delivery ──
    if (numMedia > 0) {
      const mediaUrl = form.get("MediaUrl0");
      const mediaType = form.get("MediaContentType0") || "image/jpeg";
      if (!mediaType.startsWith("image/")) {
        return twiml("Please send a photo (image) of the note. 📸");
      }

      const headers = {};
      if (mediaUrl.includes("twilio.com")) {
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const token = process.env.TWILIO_AUTH_TOKEN;
        headers.Authorization = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
      }
      const mediaRes = await fetch(mediaUrl, { headers });
      if (!mediaRes.ok) throw new Error(`media download failed: ${mediaRes.status}`);
      const bytes = Buffer.from(await mediaRes.arrayBuffer());

      const delivery = await processDeliveryImage({
        bytes,
        mimeType: mediaType,
        source: "whatsapp",
        vendorName: profileName || from,
        sourceRef: from,
      });

      if (delivery.lines.length === 0) {
        return twiml("🤖 I couldn't read any items on that note. Please send a clearer, well-lit photo.");
      }

      const list = delivery.lines
        .slice(0, 12)
        .map((l) => `• ${l.product ? l.product.name : l.rawName} ×${l.resolvedQty}${l.product ? "" : " (needs matching)"}`)
        .join("\n");

      return twiml(
        `✅ Got your note! I read ${delivery.lines.length} item(s):\n${list}\n\nReply *CONFIRM* to add these to stock, or *CANCEL* to discard.`
      );
    }

    // ── A text arrived → treat as a command on the latest pending delivery ──
    if (CONFIRM_WORDS.includes(body)) {
      const pending = await prisma.delivery.findFirst({
        where: { sourceRef: from, status: "pending" },
        orderBy: { id: "desc" },
        include: { lines: true },
      });
      if (!pending) {
        return twiml("You have no pending delivery to confirm. Send a photo of a note first. 📸");
      }
      const reviewed = pending.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        resolvedQty: l.resolvedQty,
        include: Boolean(l.productId),
      }));
      const applied = await prisma.$transaction((tx) => applyDeliveryToStock(tx, pending.id, reviewed));
      const list = applied.map((a) => `• ${a.name} ×${a.qty}`).join("\n");
      return twiml(`✅ Stock updated!\n${list || "(no items matched the catalogue)"}`);
    }

    if (CANCEL_WORDS.includes(body)) {
      const pending = await prisma.delivery.findFirst({
        where: { sourceRef: from, status: "pending" },
        orderBy: { id: "desc" },
      });
      if (pending) {
        await prisma.delivery.delete({ where: { id: pending.id } });
        return twiml("🗑️ Discarded. Send a new photo whenever you like.");
      }
      return twiml("Nothing pending to cancel.");
    }

    return twiml(
      "👋 Namaste! Send a *photo* of a delivery note. After I read it, reply *CONFIRM* to update stock or *CANCEL* to discard."
    );
  } catch (err) {
    console.error("whatsapp error:", err);
    return twiml("⚠️ Sorry, something went wrong. Please try again in a moment.");
  }
}

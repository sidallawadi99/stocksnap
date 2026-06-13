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

// Send an extra WhatsApp message immediately (e.g. a "reading…" acknowledgement)
// via Twilio's REST API. Best-effort — never blocks the main reply.
async function sendWhatsApp(to, from, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !to || !from) return;
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
  } catch {
    /* ignore — the main reply still goes out */
  }
}

const CONFIRM_WORDS = ["confirm", "yes", "y", "ok", "okay", "haan", "ha", "han", "done", "sahi", "theek"];
const CANCEL_WORDS = ["cancel", "no", "nahi", "discard", "reject", "galat"];

export async function GET() {
  return new Response("StockSnap WhatsApp webhook is live ✅", { status: 200 });
}

// POST /api/whatsapp — Twilio posts here when a WhatsApp message arrives.
export async function POST(request) {
  try {
    const form = await request.formData();
    const numMedia = parseInt(form.get("NumMedia") || "0", 10);
    const profileName = form.get("ProfileName") || null;
    const from = form.get("From") || ""; // the vendor/owner
    const to = form.get("To") || ""; // our sandbox number
    const body = (form.get("Body") || "").trim().toLowerCase();

    // ── A photo arrived → read it and create a PENDING delivery ──
    if (numMedia > 0) {
      const mediaUrl = form.get("MediaUrl0");
      const mediaType = form.get("MediaContentType0") || "image/jpeg";
      if (!mediaType.startsWith("image/")) {
        return twiml("Please send a photo (image) of the note. 📸");
      }

      // Instant acknowledgement so the user knows it's working (the AI takes a few seconds).
      await sendWhatsApp(from, to, "🤖 Got your note! Reading it now… ⏳");

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

    // ── A text arrived → command on the latest pending delivery ──
    // Tolerant matching: case-insensitive, ignores punctuation, checks the first word.
    const norm = body.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const firstWord = norm.split(/\s+/)[0] || "";
    const isConfirm = CONFIRM_WORDS.includes(norm) || CONFIRM_WORDS.includes(firstWord) || body.includes("✅");
    const isCancel = CANCEL_WORDS.includes(norm) || CANCEL_WORDS.includes(firstWord) || body.includes("❌");

    if (isConfirm) {
      const pending = await prisma.delivery.findFirst({
        where: { sourceRef: from, status: "pending" },
        orderBy: { id: "desc" },
        include: { lines: true },
      });
      if (!pending) {
        return twiml("You have no pending delivery to confirm. Send a photo of a note first. 📸");
      }
      const reviewed = pending.lines.map((l) => ({
        id: l.id, productId: l.productId, resolvedQty: l.resolvedQty, include: Boolean(l.productId),
      }));
      const applied = await prisma.$transaction((tx) => applyDeliveryToStock(tx, pending.id, reviewed));
      const list = applied.map((a) => `• ${a.name} ×${a.qty}`).join("\n");
      return twiml(`✅ Stock updated!\n${list || "(no items matched the catalogue)"}`);
    }

    if (isCancel) {
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

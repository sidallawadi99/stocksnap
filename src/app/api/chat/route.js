import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildInventoryContext } from "@/lib/inventory";

const SYSTEM = (date, inventory) => `You are "StockSnap Assistant", a friendly inventory helper for an Indian kirana (grocery) store owner.

Rules:
- Answer ONLY from the INVENTORY DATA below. Do not invent products or numbers.
- Be concise and practical. Use short lists when helpful.
- Reply in the SAME language/style as the user (English, Hindi, or Hinglish).
- Stock is in each item's base unit (packet, loaf, tray, cup, etc.).
- "local_vendor" items come from daily handwritten slips; "distributor" items are formal stock.
- "expiring today" and "added today" are already computed per item — use them directly.
- If a question can't be answered from the data, say so briefly.

Today's date: ${date}.

INVENTORY DATA:
${inventory}`;

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // Gemini's conversation must start with a user turn, so drop any leading
    // assistant messages (e.g. the greeting) before mapping.
    let convo = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));
    while (convo.length && convo[0].role === "model") convo.shift();
    if (convo.length === 0) {
      return NextResponse.json({ error: "No question provided." }, { status: 400 });
    }

    const inventory = await buildInventoryContext();
    const todayLabel = new Date().toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: convo,
      config: { systemInstruction: SYSTEM(todayLabel, inventory) },
    });

    const answer = (response.text ?? "").trim() || "Sorry, I couldn't find that in the inventory.";
    return NextResponse.json({ answer });
  } catch (err) {
    console.error("chat error:", err);
    return NextResponse.json({ error: err.message || "Chat failed." }, { status: 500 });
  }
}

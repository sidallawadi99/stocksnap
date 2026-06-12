import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildInventoryContext } from "@/lib/inventory";

// GET /api/insights -> a few short, actionable insights generated from live inventory.
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const inventory = await buildInventoryContext();
    const today = new Date().toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const prompt = `You are an inventory analyst for an Indian kirana (grocery) store. Today is ${today}.

From the INVENTORY DATA below, produce 4-5 SHORT, actionable insights for the owner. Prioritise:
- items expiring today (waste / discount-to-sell risk),
- low stock that needs reordering (especially daily-vendor items),
- what changed today,
- any quick win.

Return ONLY a JSON array. Each element: {"emoji": one relevant emoji, "title": a 2-4 word headline, "text": one concise, specific sentence with numbers}. No text outside the JSON.

INVENTORY DATA:
${inventory}`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    let text = (response.text ?? "").trim();
    if (text.startsWith("```")) text = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    let insights = [];
    try {
      const parsed = JSON.parse(text);
      insights = Array.isArray(parsed) ? parsed : parsed.insights || [];
    } catch {
      insights = [];
    }

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("insights error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate insights." }, { status: 500 });
  }
}

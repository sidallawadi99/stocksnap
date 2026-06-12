import { GoogleGenAI } from "@google/genai";

// The instruction we give the AI. Being specific here is what makes the
// extraction reliable on messy, handwritten, Hindi-or-English delivery notes.
const PROMPT = `You are reading a handwritten DELIVERY NOTE handed to an Indian kirana (grocery) store by a daily vendor (milk man, bread man, etc.).

Extract every line item on the note. Quantities and item names may be in English or Hindi (e.g. "doodh" = milk, "peti"/"crate" = crate, "packet"/"pkt" = packet).

Return ONLY a JSON array. Each element must be an object with these fields:
- "rawText":   the original line exactly as written, e.g. "Toned Milk - 1 crate"
- "name":      the product name in clean English, e.g. "Toned Milk"
- "quantity":  the number as a plain number, e.g. 1 or 30
- "unit":      ONE of: "packet", "crate", "loaf", "tray", "cup", "pack", "litre", "kg", "piece". Pick the best fit. If a crate/peti is mentioned, use "crate".
- "confidence": your confidence from 0 to 1 that you read this line correctly.

If you cannot read the note at all, return an empty array []. Do not add any text outside the JSON.`;

/**
 * Sends an image to Gemini and returns the extracted line items.
 * @param {string} base64Image - the photo encoded as a base64 string
 * @param {string} mimeType - e.g. "image/jpeg" or "image/png"
 * @returns {Promise<Array<{rawText:string,name:string,quantity:number,unit:string,confidence:number}>>}
 */
export async function extractDeliveryItems(base64Image, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to your .env.local file (see README)."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    config: {
      // Force the model to answer with raw JSON, not chatty text.
      responseMimeType: "application/json",
    },
  });

  const text = (response.text ?? "").trim();
  return safeParseItems(text);
}

// The model is told to return JSON, but we defend against stray markdown
// fences or extra characters just in case. Exported for testing.
export function safeParseItems(text) {
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    // Some models wrap the array in an object like { items: [...] }
    if (Array.isArray(parsed.items)) return parsed.items;
    return [];
  } catch {
    return [];
  }
}

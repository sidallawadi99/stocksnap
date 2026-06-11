// Turns a messy read name like "tonned milk" into a real catalogue product,
// and converts crates into the product's base unit (e.g. 1 crate -> 30 packets).

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // drop punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// How many words two strings share, as a ratio (0 to 1).
function tokenOverlap(a, b) {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

// Score one product against the read name. Higher = better match.
function scoreProduct(readName, product) {
  const q = normalize(readName);
  const candidates = [product.name, ...(product.aliases ? product.aliases.split(",") : [])];

  let best = 0;
  for (const c of candidates) {
    const nc = normalize(c);
    if (!nc) continue;
    if (q === nc) best = Math.max(best, 1); // exact match
    else if (q.includes(nc) || nc.includes(q)) best = Math.max(best, 0.85); // one contains the other
    best = Math.max(best, tokenOverlap(q, nc)); // shared words
  }
  return best;
}

/**
 * Find the best catalogue product for an extracted line.
 * @returns {{product: object|null, score: number}}
 */
export function findBestProduct(readName, products) {
  let bestProduct = null;
  let bestScore = 0;
  for (const product of products) {
    const score = scoreProduct(readName, product);
    if (score > bestScore) {
      bestScore = score;
      bestProduct = product;
    }
  }
  // Below this threshold we treat it as "no confident match".
  if (bestScore < 0.34) return { product: null, score: bestScore };
  return { product: bestProduct, score: bestScore };
}

/**
 * Convert an extracted quantity into the product's base unit.
 * e.g. 1 "crate" of a product with unitsPerCrate=30 -> 30.
 */
export function resolveQuantity(quantity, unit, product) {
  const qty = Number(quantity) || 0;
  if (!product) return Math.round(qty);
  const u = (unit || "").toLowerCase();
  if (u === "crate" || u === "peti" || u === "box") {
    return Math.round(qty * (product.unitsPerCrate || 1));
  }
  return Math.round(qty);
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDeliveryToStock, reverseDelivery } from "../src/lib/deliveries.js";

// A fake Prisma transaction. The real functions only call these methods, so we
// can test all the logic (stock math, edit-flag, batches) without a database.
function makeTx({ products = {}, lines = {} } = {}) {
  const calls = { lineUpdates: [], productUpdates: [], batches: [], deliveryUpdates: [], batchDeletes: [] };
  const tx = {
    deliveryLine: {
      findUnique: async ({ where: { id } }) => lines[id] || null,
      update: async ({ where: { id }, data }) => { calls.lineUpdates.push({ id, ...data }); },
    },
    product: {
      findUnique: async ({ where: { id } }) => products[id] || null,
      update: async ({ where: { id }, data }) => {
        const p = products[id];
        if (data.stock?.increment != null) p.stock += data.stock.increment;
        if (typeof data.stock === "number") p.stock = data.stock;
        calls.productUpdates.push({ id, data });
        return p;
      },
    },
    batch: {
      create: async ({ data }) => { calls.batches.push(data); },
      deleteMany: async ({ where }) => { calls.batchDeletes.push(where); },
    },
    delivery: {
      update: async ({ where: { id }, data }) => { calls.deliveryUpdates.push({ id, ...data }); },
    },
  };
  return { tx, calls };
}

// ── applyDeliveryToStock ─────────────────────────────────────────────────────
test("apply: confirms an unchanged line, increments stock, writes a batch", async () => {
  const products = { 1: { id: 1, name: "Toned Milk", shelfLifeDays: 2, stock: 10 } };
  const lines = { 100: { aiProductId: 1, aiResolvedQty: 30 } };
  const { tx, calls } = makeTx({ products, lines });

  const applied = await applyDeliveryToStock(tx, 50, [{ id: 100, productId: 1, resolvedQty: 30, include: true }]);

  assert.equal(products[1].stock, 40); // 10 + 30
  assert.deepEqual(applied, [{ name: "Toned Milk", qty: 30 }]);
  assert.equal(calls.batches.length, 1);
  assert.equal(calls.batches[0].deliveryId, 50);
  assert.equal(calls.lineUpdates[0].edited, false); // matched the AI exactly
  assert.equal(calls.deliveryUpdates[0].status, "confirmed");
});

test("apply: a changed quantity is flagged as edited", async () => {
  const products = { 1: { id: 1, name: "Curd", shelfLifeDays: 4, stock: 0 } };
  const lines = { 100: { aiProductId: 1, aiResolvedQty: 12 } };
  const { tx, calls } = makeTx({ products, lines });

  await applyDeliveryToStock(tx, 1, [{ id: 100, productId: 1, resolvedQty: 15, include: true }]);
  assert.equal(calls.lineUpdates[0].edited, true);
  assert.equal(products[1].stock, 15);
});

test("apply: a changed product is flagged as edited", async () => {
  const products = { 2: { id: 2, name: "Brown Bread", shelfLifeDays: 4, stock: 0 } };
  const lines = { 100: { aiProductId: 1, aiResolvedQty: 5 } }; // AI said product 1
  const { tx, calls } = makeTx({ products, lines });

  await applyDeliveryToStock(tx, 1, [{ id: 100, productId: 2, resolvedQty: 5, include: true }]); // user picked 2
  assert.equal(calls.lineUpdates[0].edited, true);
});

test("apply: excluding an AI-matched line counts as edited and adds no stock", async () => {
  const products = { 1: { id: 1, name: "Paneer", shelfLifeDays: 5, stock: 4 } };
  const lines = { 100: { aiProductId: 1, aiResolvedQty: 6 } };
  const { tx, calls } = makeTx({ products, lines });

  const applied = await applyDeliveryToStock(tx, 1, [{ id: 100, productId: null, resolvedQty: 6, include: false }]);
  assert.equal(products[1].stock, 4); // unchanged
  assert.equal(applied.length, 0);
  assert.equal(calls.batches.length, 0);
  assert.equal(calls.lineUpdates[0].edited, true);
});

test("apply: non-perishable product gets stock but no batch", async () => {
  const products = { 9: { id: 9, name: "Rice", shelfLifeDays: null, stock: 0 } };
  const lines = { 100: { aiProductId: 9, aiResolvedQty: 3 } };
  const { tx, calls } = makeTx({ products, lines });

  await applyDeliveryToStock(tx, 1, [{ id: 100, productId: 9, resolvedQty: 3, include: true }]);
  assert.equal(products[9].stock, 3);
  assert.equal(calls.batches.length, 0);
});

// ── reverseDelivery ──────────────────────────────────────────────────────────
test("reverse: subtracts confirmed line quantities and removes batches", async () => {
  const products = { 1: { id: 1, stock: 40 } };
  const { tx, calls } = makeTx({ products });
  const delivery = { id: 50, lines: [{ status: "confirmed", productId: 1, resolvedQty: 30 }] };

  await reverseDelivery(tx, delivery);
  assert.equal(products[1].stock, 10); // 40 - 30
  assert.deepEqual(calls.batchDeletes[0], { deliveryId: 50 });
});

test("reverse: clamps stock at 0, never negative", async () => {
  const products = { 1: { id: 1, stock: 5 } };
  const { tx } = makeTx({ products });
  await reverseDelivery(tx, { id: 1, lines: [{ status: "confirmed", productId: 1, resolvedQty: 30 }] });
  assert.equal(products[1].stock, 0);
});

test("reverse: ignores non-confirmed or unmatched lines", async () => {
  const products = { 1: { id: 1, stock: 20 } };
  const { tx } = makeTx({ products });
  await reverseDelivery(tx, {
    id: 1,
    lines: [
      { status: "unmatched", productId: null, resolvedQty: 10 },
      { status: "matched", productId: 1, resolvedQty: 5 }, // pending, not confirmed
    ],
  });
  assert.equal(products[1].stock, 20); // untouched
});

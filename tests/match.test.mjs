import { test } from "node:test";
import assert from "node:assert/strict";
import { findBestProduct, resolveQuantity } from "../src/lib/match.js";

// A small catalogue that mirrors the real seed (the tricky pairs are here:
// "Toned" vs "Double Toned", and a generic "bread").
const products = [
  { id: 1, name: "Toned Milk 500ml",        unit: "packet", unitsPerCrate: 30, aliases: "toned milk,toned,tm,tonned milk,doodh", supply: "local_vendor" },
  { id: 2, name: "Double Toned Milk 500ml", unit: "packet", unitsPerCrate: 30, aliases: "double toned,dt milk", supply: "local_vendor" },
  { id: 3, name: "Full Cream Milk 500ml",   unit: "packet", unitsPerCrate: 30, aliases: "full cream,fc milk", supply: "local_vendor" },
  { id: 4, name: "Curd 400g",               unit: "cup",    unitsPerCrate: 12, aliases: "curd,dahi,yogurt", supply: "local_vendor" },
  { id: 5, name: "White Bread 400g",        unit: "loaf",   unitsPerCrate: 1,  aliases: "white bread,bread,safed bread", supply: "local_vendor" },
];

const byName = (name) => findBestProduct(name, products).product?.name ?? null;

test("matches an exact product name", () => {
  assert.equal(byName("Toned Milk"), "Toned Milk 500ml");
});

test("matches a misspelled alias (tonned milk)", () => {
  assert.equal(byName("tonned milk"), "Toned Milk 500ml");
});

test("matches a Hindi alias (dahi -> Curd)", () => {
  assert.equal(byName("dahi"), "Curd 400g");
});

test("matches real handwritten text with brand + size", () => {
  assert.equal(byName("Amul toned 500ml"), "Toned Milk 500ml");
});

test("EDGE: 'double toned milk' must not collapse to plain 'Toned Milk'", () => {
  assert.equal(byName("double toned milk"), "Double Toned Milk 500ml");
});

test("EDGE: empty / blank input returns no match", () => {
  assert.equal(findBestProduct("", products).product, null);
  assert.equal(findBestProduct("   ", products).product, null);
});

test("EDGE: gibberish below threshold returns no match", () => {
  assert.equal(findBestProduct("zxqw foobar", products).product, null);
});

test("EDGE: empty catalogue returns no match (no crash)", () => {
  assert.equal(findBestProduct("toned milk", []).product, null);
});

// ── unit conversion ──────────────────────────────────────────────
const milk = products[0]; // unitsPerCrate 30
const curd = products[3]; // unitsPerCrate 12

test("converts crates to base units", () => {
  assert.equal(resolveQuantity(2, "crate", milk), 60);
  assert.equal(resolveQuantity(1, "peti", milk), 30); // peti == crate
  assert.equal(resolveQuantity(1, "box", curd), 12);
});

test("leaves base units unchanged", () => {
  assert.equal(resolveQuantity(20, "packet", milk), 20);
  assert.equal(resolveQuantity(15, null, curd), 15);
});

test("rounds fractional crates", () => {
  assert.equal(resolveQuantity(2.5, "crate", milk), 75);
});

test("EDGE: non-numeric quantity becomes 0", () => {
  assert.equal(resolveQuantity("abc", "packet", milk), 0);
});

test("EDGE: no matched product still returns a sane number", () => {
  assert.equal(resolveQuantity(5, "crate", null), 5); // can't convert without a product
});

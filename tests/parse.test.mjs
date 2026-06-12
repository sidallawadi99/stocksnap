import { test } from "node:test";
import assert from "node:assert/strict";
import { safeParseItems } from "../src/lib/gemini.js";

// The AI is told to return a JSON array, but real models sometimes wrap it in
// markdown fences or an object. These tests pin down our defensive parsing.

test("parses a clean JSON array", () => {
  const out = safeParseItems('[{"name":"Toned Milk","quantity":2,"unit":"crate"}]');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Toned Milk");
});

test("strips ```json markdown fences", () => {
  const out = safeParseItems('```json\n[{"name":"Bread","quantity":10,"unit":"loaf"}]\n```');
  assert.equal(out.length, 1);
  assert.equal(out[0].quantity, 10);
});

test("unwraps an { items: [...] } object", () => {
  const out = safeParseItems('{"items":[{"name":"Curd","quantity":12,"unit":"cup"}]}');
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Curd");
});

test("EDGE: invalid JSON returns an empty array (no crash)", () => {
  assert.deepEqual(safeParseItems("sorry, I cannot read this note"), []);
});

test("EDGE: empty string returns an empty array", () => {
  assert.deepEqual(safeParseItems(""), []);
});

test("EDGE: a JSON object that is not a list returns an empty array", () => {
  assert.deepEqual(safeParseItems('{"foo":"bar"}'), []);
});

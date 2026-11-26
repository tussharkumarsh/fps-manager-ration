import test from "node:test";
import assert from "node:assert/strict";

import { canonicalCommodity, govStockByCommodity } from "./govStock";

const entry = (commodity: string, n: number) => ({
  commodity, unit: "Kgs", alloted: 0, opening: n, receivedRegular: 10 * n, receivedExtra: 1, receivedMoved: 2,
  issued: 5 * n, closing: n + 10 * n + 3 - 5 * n,
});

test("canonicalCommodity matches inventory item names to register commodities", () => {
  assert.equal(canonicalCommodity("Saree Kit"), "saree");
  assert.equal(canonicalCommodity("SAREE"), "saree");
  assert.equal(canonicalCommodity("FRice"), "rice");
  assert.equal(canonicalCommodity(" Wheat "), "wheat");
  assert.equal(canonicalCommodity("Bajra"), "bajra");
});

test("govStockByCommodity keys entries by canonical name and totals all receipt kinds", () => {
  const map = govStockByCommodity([entry("Wheat", 1), entry("SAREE", 2)]);
  assert.deepEqual(map.get("wheat"), { opening: 1, received: 13, issued: 5, closing: 9 });
  assert.equal(map.get(canonicalCommodity("Saree Kit"))?.opening, 2);
  assert.equal(map.get("rice"), undefined);
});

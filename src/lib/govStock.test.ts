import test from "node:test";
import assert from "node:assert/strict";

import { canonicalCommodity, extraGovCommodities, govStockByCommodity } from "./govStock";

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
  assert.deepEqual(map.get("wheat"), { allotted: 0, opening: 1, received: 13, issued: 5, closing: 9 });
  assert.equal(map.get(canonicalCommodity("Saree Kit"))?.opening, 2);
  assert.equal(map.get("rice"), undefined);
});

test("extraGovCommodities lists register commodities no inventory item covers, with name and unit", () => {
  const extras = extraGovCommodities(
    [
      { ...entry("Wheat", 1) },
      { ...entry("Wheat-PMGKAY", 3) },
      { ...entry("PMGKAY Bag", 4), unit: "PKTS" },
      { ...entry("SAREE", 2), unit: "PKTS" },
    ],
    ["wheat", canonicalCommodity("Saree Kit")]
  );
  assert.deepEqual(extras.map((e) => [e.name, e.unit, e.opening, e.received, e.issued, e.closing]), [
    ["Wheat-PMGKAY", "Kgs", 3, 33, 15, 21],
    ["PMGKAY Bag", "PKTS", 4, 43, 20, 27],
  ]);
});

test("extraGovCommodities skips commodities with no stock movement at all", () => {
  const zero = { commodity: "Maize", unit: "Kgs", alloted: 0, opening: 0, receivedRegular: 0, receivedExtra: 0, receivedMoved: 0, issued: 0, closing: 0 };
  assert.deepEqual(extraGovCommodities([zero], []), []);
});

test("govStockByCommodity carries the allotment", () => {
  const map = govStockByCommodity([{ ...entry("Wheat", 1), alloted: 4700 }]);
  assert.equal(map.get("wheat")?.allotted, 4700);
});

import test from "node:test";
import assert from "node:assert/strict";

import { itemsOf, multiTransactionFamilies, transactionBreakdown } from "./multiTransactions";
import { homeFpsOf, seenOtherShops, shopLabel } from "./otherShops";
import type { FpsDirectoryEntry, OtherShop, Transaction } from "@/types";

let seq = 0;
const tx = (srcNo: string, date: string, q: Partial<Transaction> = {}): Transaction => ({
  id: String(++seq), slNo: seq, srcNo, scheme: "PHH", availType: "Authenticated", receiptNo: String(seq),
  date, wheat: 0, rice: 0, sugar: 0, saree: 0, jowar: 0, amount: 0, portability: "Self", ...q,
});

test("transactionBreakdown reconciles transactions with families", () => {
  const txs = [
    tx("A", "2026-11-01 10:00", { wheat: 10 }),
    tx("B", "2026-11-01 10:00", { wheat: 10 }),
    tx("B", "2026-11-02 10:00", { sugar: 1 }),
    tx("C", "2026-11-01 10:00", { wheat: 10 }),
    tx("C", "2026-11-02 10:00", { wheat: 5 }),
    tx("C", "2026-11-03 10:00", { rice: 5 }),
  ];
  const b = transactionBreakdown(txs);
  assert.equal(b.transactions, 6);
  assert.equal(b.families, 3);
  assert.equal(b.singleFamilies, 1);
  assert.equal(b.multiFamilies, 2);
  assert.equal(b.multiTransactions, 5);
  assert.equal(b.extraTransactions, 3);
  assert.deepEqual(b.byCount, { 1: 1, 2: 1, 3: 1 });
});

test("multiTransactionFamilies lists repeat families with their items", () => {
  const txs = [
    tx("A", "2026-11-01 10:00", { wheat: 10 }),
    tx("B", "2026-11-06 09:52", { sugar: 3 }),
    tx("B", "2026-11-06 09:51", { wheat: 11, rice: 13, jowar: 11 }),
    tx("C", "2026-11-08 09:05", { wheat: 21, rice: 14, portability: "151209500224" }),
    tx("C", "2026-11-08 09:06", { wheat: 10.5, rice: 14, jowar: 10.5, portability: "151209500224" }),
  ];
  const fams = multiTransactionFamilies(txs);
  assert.deepEqual(fams.map((f) => f.srcNo), ["B", "C"]);
  const [b, c] = fams;
  assert.deepEqual(b.transactions.map((t) => t.date), ["2026-11-06 09:51", "2026-11-06 09:52"]);
  assert.deepEqual(b.repeatedItems, []);
  assert.deepEqual(b.totals, { wheat: 11, rice: 13, sugar: 3, jowar: 11 });
  assert.equal(b.homeFps, "");
  assert.deepEqual(c.repeatedItems, ["wheat", "rice"]);
  assert.equal(c.homeFps, "151209500224");
  assert.deepEqual(itemsOf(c.transactions[1]), ["wheat", "rice", "jowar"]);
});

test("other shops are collected from the portability column, skipping own cards", () => {
  const txs = [
    tx("X1", "2026-11-01 10:00", { portability: "151209500218" }),
    tx("X1", "2026-11-03 10:00", { portability: "151209500218" }),
    tx("X2", "2026-11-02 10:00", { portability: "151209500218" }),
    tx("X3", "2026-11-05 10:00", { portability: "151209500228" }),
    tx("OWN", "2026-11-06 10:00", { portability: "151209500299" }),
    tx("S", "2026-11-06 10:00"),
  ];
  const shops = seenOtherShops(txs, [{ srcNo: "OWN", name: "Own" }]);
  assert.deepEqual(shops, [
    { shopFpsId: "151209500228", families: 1, transactions: 1, lastDate: "2026-11-05 10:00" },
    { shopFpsId: "151209500218", families: 2, transactions: 3, lastDate: "2026-11-03 10:00" },
  ]);
  assert.equal(homeFpsOf({ portability: " self " }), "");
});

test("shopLabel prefers the saved shop name, then the portal owner name", () => {
  const map = new Map<string, OtherShop>([
    ["151209500218", { shopFpsId: "151209500218", shopName: "Ram Ration", dealerName: "", mobile: "", altMobile: "", address: "", notes: "", updatedAt: "" }],
  ]);
  assert.equal(shopLabel("151209500218", map), "151209500218 · Ram Ration");
  assert.equal(shopLabel("151209500228", map), "151209500228");
  const dir = new Map([
    ["151209500218", { shopFpsId: "151209500218", ownerName: "Prakash Vithoba Rajguru" }],
    ["151209500228", { shopFpsId: "151209500228", ownerName: "JAYSHRI GULAB PARGHANE" }],
  ] as [string, FpsDirectoryEntry][]);
  assert.equal(shopLabel("151209500218", map, dir), "151209500218 · Ram Ration");
  assert.equal(shopLabel("151209500228", map, dir), "151209500228 · JAYSHRI GULAB PARGHANE");
});

test("seenOtherShops still lists a card that is in the master from another FPS's file", () => {
  const txs = [tx("B1", "2026-11-05 10:00", { portability: "151209500199" })];
  const master = [{ srcNo: "B1", name: "Other", sourceFpsId: "151209500199" }];
  const shops = seenOtherShops(txs, master, "151209500212");
  assert.deepEqual(shops.map((s) => [s.shopFpsId, s.families]), [["151209500199", 1]]);
});

test("seenOtherShops lists the shop of an old master card whose transactions name it", () => {
  const txs = [tx("L1", "2026-11-12 10:34", { portability: "151209500228" })];
  const master = [{ srcNo: "L1", name: "legacy" }];
  assert.deepEqual(seenOtherShops(txs, master, "151209500212").map((s) => s.shopFpsId), ["151209500228"]);
  // Confirmed by the dealer's own file: stays own, not seen as another shop.
  assert.deepEqual(seenOtherShops(txs, [{ srcNo: "L1", name: "x", sourceFpsId: "151209500212" }], "151209500212"), []);
});

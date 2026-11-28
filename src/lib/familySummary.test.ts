import test from "node:test";
import assert from "node:assert/strict";

import { customersWithTransactions, familySummary, isOwnCard, monthlyFamilySummary } from "./familySummary";
import type { Customer, Transaction } from "@/types";

const cust = (srcNo: string, scheme: "PHH" | "AAY", disabled = false): Customer => ({
  srcNo, name: `N${srcNo}`, scheme, disabled,
});

let seq = 0;
const tx = (srcNo: string, scheme: "PHH" | "AAY", date: string, portability = "Self"): Transaction => ({
  id: String(++seq), slNo: seq, srcNo, scheme, availType: "Authenticated", receiptNo: String(seq),
  date, wheat: 5, rice: 5, sugar: 0, saree: 0, jowar: 0, amount: 0, portability,
});

const customers = [
  cust("A1", "AAY"), cust("A2", "AAY"),
  cust("P1", "PHH"), cust("P2", "PHH"), cust("P3", "PHH"),
  cust("D1", "PHH", true), cust("D2", "AAY", true),
];

test("counts families, not transactions, against active Customer Master families", () => {
  const txs = [
    tx("A1", "AAY", "2026-06-01 10:00"),
    tx("A1", "AAY", "2026-06-02 10:00"), // repeat transaction, same family
    tx("P1", "PHH", "2026-06-01 10:00"),
    tx("P1", "PHH", "2026-06-05 10:00"),
    tx("P1", "PHH", "2026-06-09 10:00"),
  ];
  const s = familySummary(txs, customers);
  assert.deepEqual(s.registered, { total: 5, phh: 3, aay: 2 });
  assert.deepEqual(s.collected, { total: 2, phh: 1, aay: 1 });
  assert.deepEqual(s.pending, { total: 3, phh: 2, aay: 1 });
  assert.deepEqual(s.pendingCustomers.map((c) => c.srcNo).sort(), ["A2", "P2", "P3"]);
  assert.equal(s.transactions, 5);
});

test("other-shop and disabled families are counted separately, never as collected", () => {
  const txs = [
    tx("P1", "PHH", "2026-06-01 10:00"),
    tx("X1", "PHH", "2026-06-01 10:00", "151209500218"),
    tx("X1", "PHH", "2026-06-03 10:00", "151209500218"),
    tx("X2", "AAY", "2026-06-01 10:00", "151209500228"),
    tx("D1", "PHH", "2026-06-02 10:00"),
    tx("D1", "PHH", "2026-06-04 10:00"),
  ];
  const s = familySummary(txs, customers);
  assert.deepEqual(s.collected, { total: 1, phh: 1, aay: 0 });
  assert.deepEqual(s.otherShop, { total: 2, phh: 1, aay: 1 });
  assert.deepEqual(s.otherShopFamilies.map((f) => [f.srcNo, f.homeFps, f.transactions]), [
    ["X1", "151209500218", 2],
    ["X2", "151209500228", 1],
  ]);
  assert.deepEqual(s.disabledServed, { total: 1, phh: 1, aay: 0 });
  assert.equal(s.disabledFamilies[0].customer.srcNo, "D1");
  assert.equal(s.disabledFamilies[0].transactions, 2);
  assert.deepEqual(s.servedByScheme, { total: 4, phh: 3, aay: 1 });
});

test("scheme comes from Customer Master for registered families", () => {
  // The portal recorded the transaction as PHH but the master says AAY.
  const s = familySummary([tx("A1", "PHH", "2026-06-01 10:00")], customers);
  assert.deepEqual(s.collected, { total: 1, phh: 0, aay: 1 });
});

test("over several months a family that collected in any month counts once", () => {
  const txs = [
    tx("A1", "AAY", "2026-05-01 10:00"),
    tx("A1", "AAY", "2026-06-01 10:00"),
    tx("P1", "PHH", "2026-05-01 10:00"),
  ];
  const s = familySummary(txs, customers);
  assert.deepEqual(s.collected, { total: 2, phh: 1, aay: 1 });
  assert.deepEqual(s.pending, { total: 3, phh: 2, aay: 1 });
});

test("monthlyFamilySummary gives one row per month, newest first", () => {
  const txs = [
    tx("A1", "AAY", "2026-05-01 10:00"),
    tx("A1", "AAY", "2026-06-01 10:00"),
    tx("P1", "PHH", "2026-06-01 10:00"),
    tx("X1", "PHH", "2026-06-01 10:00", "151209500218"),
  ];
  const rows = monthlyFamilySummary(txs, customers);
  assert.deepEqual(rows.map((r) => r.month), ["2026-06", "2026-05"]);
  assert.deepEqual(rows[0].summary.collected, { total: 2, phh: 1, aay: 1 });
  assert.equal(rows[0].summary.otherShop.total, 1);
  assert.deepEqual(rows[1].summary.collected, { total: 1, phh: 0, aay: 1 });
});

test("monthlyFamilySummary groups by ration month, not transaction date", () => {
  const txs = [
    { ...tx("A1", "AAY", "2026-04-10 10:00"), year: "2026", month: "4" },
    { ...tx("P1", "PHH", "2026-05-10 10:00"), year: "2026", month: "4" },
    { ...tx("P2", "PHH", "2026-06-10 10:00"), year: "2026", month: "4" },
  ];
  const rows = monthlyFamilySummary(txs, customers);
  assert.deepEqual(rows.map((r) => r.month), ["2026-04"]);
  assert.deepEqual(rows[0].summary.collected, { total: 3, phh: 2, aay: 1 });
});

test("own cards missing from Customer Master are not counted as other shops", () => {
  const txs = [
    tx("NEW1", "PHH", "2026-11-19 09:47"), // portability "Self", not in master
    tx("X1", "PHH", "2026-11-01 10:00", "151209500218"),
    tx("MIX", "AAY", "2026-11-01 10:00", "151209500228"),
    tx("MIX", "AAY", "2026-11-05 10:00"), // later visit recorded as Self
  ];
  const s = familySummary(txs, customers);
  assert.deepEqual(s.unlisted, { total: 1, phh: 1, aay: 0 });
  assert.deepEqual(s.unlistedFamilies.map((f) => f.srcNo), ["NEW1"]);
  assert.deepEqual(s.otherShop, { total: 2, phh: 1, aay: 1 });
  assert.deepEqual(s.otherShopFamilies.map((f) => [f.srcNo, f.homeFps]), [
    ["X1", "151209500218"],
    ["MIX", "151209500228"],
  ]);
  assert.equal(s.servedByScheme.total, 3);
});

test("customersWithTransactions keeps only master cards that ever transacted", () => {
  const txs = [tx("A1", "AAY", "2026-06-01 10:00"), tx("D1", "PHH", "2026-05-01 10:00"), tx("X9", "PHH", "2026-06-02 10:00")];
  assert.deepEqual(customersWithTransactions(customers, txs).map((c) => c.srcNo), ["A1", "D1"]);
  // Nothing loaded yet: nothing to check against, the master stays whole.
  assert.equal(customersWithTransactions(customers, []).length, customers.length);
});

test("isOwnCard: no source or the dealer's FPS is own; another FPS is not", () => {
  assert.equal(isOwnCard({ srcNo: "1", name: "a" }, "151209500212"), true);
  assert.equal(isOwnCard({ srcNo: "1", name: "a", sourceFpsId: "151209500212" }, "151209500212"), true);
  assert.equal(isOwnCard({ srcNo: "1", name: "a", sourceFpsId: "151209500199" }, "151209500212"), false);
});

test("customersWithTransactions with a dealer FPS drops other FPSs' cards", () => {
  const master = [
    { srcNo: "A1", name: "own", sourceFpsId: "151209500212" },
    { srcNo: "B1", name: "other", sourceFpsId: "151209500199" },
  ];
  const txs = [tx("A1", "PHH", "2026-11-01 10:00"), tx("B1", "PHH", "2026-11-01 11:00", "151209500199")];
  assert.deepEqual(customersWithTransactions(master, txs, "151209500212").map((c) => c.srcNo), ["A1"]);
  // Without a dealer FPS nothing is dropped for its source.
  assert.equal(customersWithTransactions(master, txs).length, 2);
});

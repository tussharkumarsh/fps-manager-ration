import test from "node:test";
import assert from "node:assert/strict";

import { calculateDailySummary, deduplicateTransactions, getDistinctMonths, rationMonth } from "./utils";
import type { Transaction } from "@/types";

const tx = (receiptNo: string, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: receiptNo, slNo: 1, srcNo: "S1", scheme: "PHH", availType: "Authenticated", receiptNo, date,
  wheat: 5, rice: 5, sugar: 0, saree: 0, jowar: 0, amount: 0, portability: "Self", ...extra,
});

test("rationMonth uses the synced allocation month, not the transaction date", () => {
  // April 2026's allocation was distributed through June.
  assert.equal(rationMonth(tx("100000000001", "2026-06-03 10:00", { year: "2026", month: "4" })), "2026-04");
  assert.equal(rationMonth(tx("100000000001", "2026-06-03 10:00", { year: "2026", month: "11" })), "2026-11");
});

test("rationMonth falls back to the date's month when no allocation month is known", () => {
  assert.equal(rationMonth(tx("100000000001", "2026-06-03 10:00")), "2026-06");
  assert.equal(rationMonth(tx("100000000001", "2026-06-03 10:00", { year: "2026", month: "" })), "2026-06");
});

test("getDistinctMonths lists ration months", () => {
  const months = getDistinctMonths([
    tx("100000000001", "2026-05-03 10:00", { year: "2026", month: "4" }),
    tx("100000000002", "2026-06-03 10:00", { year: "2026", month: "4" }),
  ]).map((m) => m.value);
  assert.ok(months.includes("2026-04"));
  assert.ok(!months.includes("2026-05"));
  assert.ok(!months.includes("2026-06"));
});

test("deduplicateTransactions lets incoming server rows refresh cached copies", () => {
  const cached = [tx("100000000001", "2026-05-03 10:00"), tx("100000000002", "2026-05-04 10:00")];
  const merged = deduplicateTransactions(cached, [
    tx("100000000001", "2026-05-03 10:00", { year: "2026", month: "4" }),
    tx("100000000003", "2026-05-05 10:00", { year: "2026", month: "4" }),
    tx("bad", "2026-05-05 10:00"),
  ]);
  assert.deepEqual(merged.map((t) => t.receiptNo), ["100000000001", "100000000002", "100000000003"]);
  assert.equal(merged[0].month, "4");
  assert.equal(merged[1].month, undefined);
});

test("calculateDailySummary counts distinct families per day", () => {
  const rows = calculateDailySummary([
    tx("1", "2026-11-06 10:00", { srcNo: "A" }),
    tx("2", "2026-11-06 11:00", { srcNo: "A" }), // second visit, same family
    tx("3", "2026-11-06 12:00", { srcNo: "B", scheme: "AAY" }),
    tx("4", "2026-11-07 10:00", { srcNo: "A" }),
  ]);
  assert.deepEqual(rows.map((r) => [r.date, r.totalTransactions, r.totalFamilies]), [
    ["2026-11-06", 3, 2],
    ["2026-11-07", 1, 1],
  ]);
});

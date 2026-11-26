import test from "node:test";
import assert from "node:assert/strict";

import { monthsToBackfill } from "./backfill";

const now = { year: "2026", month: "11" };
const locked = (months: string[]) => months.map((month) => ({ month, status: "synced_locked" }));

test("current year: every unsynced month up to now, plus the current month", () => {
  assert.deepEqual(monthsToBackfill("2026", locked(["7", "8", "9", "10"]), now), ["1", "2", "3", "4", "5", "6", "11"]);
});

test("a month that is only 'live' (not locked) is still backfilled", () => {
  assert.deepEqual(monthsToBackfill("2026", [...locked(["1", "2", "3", "4", "5", "6", "7", "8", "9"]), { month: "10", status: "live" }], now), ["10", "11"]);
});

test("past year with no locks: all 12 months", () => {
  assert.deepEqual(monthsToBackfill("2025", [], now), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
});

test("future year: nothing", () => {
  assert.deepEqual(monthsToBackfill("2027", [], now), []);
});

test("the current month is included even when locked", () => {
  assert.deepEqual(monthsToBackfill("2026", locked(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]), now), ["11"]);
});

test("zero-padded lock months are matched", () => {
  assert.deepEqual(monthsToBackfill("2026", locked(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]), now), ["11"]);
});

test("a month locked as synced but with no stored records is backfilled", () => {
  const locks = [
    { month: "1", status: "synced_locked", storedCount: 0 },
    { month: "7", status: "synced_locked", storedCount: 0 },
    { month: "8", status: "synced_locked", storedCount: 282 },
  ];
  assert.deepEqual(monthsToBackfill("2025", locks, now), ["1", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12"]);
});

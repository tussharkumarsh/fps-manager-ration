export interface MonthLockInfo {
  month: string;
  status: string;
  /** Transactions actually stored for the month. A lock can outlive its data (e.g. after a reset). */
  storedCount?: number;
  /**
   * For status "no_allocation": the earlier allocation month that was
   * distributed through this month — the portal has no report of its own
   * for it, so there is nothing to sync.
   */
  coveredBy?: { year: string; month: string };
}

/** Months (unpadded) the backend marked as having no allocation of their own, with the allocation that covered each. */
export function noAllocationMonths(locks: MonthLockInfo[]): { month: string; coveredBy: { year: string; month: string } }[] {
  return locks
    .filter((l) => l.status === "no_allocation" && l.coveredBy)
    .map((l) => ({ month: String(parseInt(l.month, 10)), coveredBy: l.coveredBy! }))
    .sort((a, b) => Number(a.month) - Number(b.month));
}

/**
 * Months of `year` the "Sync missing months" button should fetch: every
 * month up to `now` (all 12 for a past year, none for a future one) that
 * isn't already locked as fully synced with records still stored — plus the current month always,
 * since it's still being added to on the gov side. Months with no allocation of their own
 * (status "no_allocation") are skipped: the portal has nothing to return for them.
 */
export function monthsToBackfill(
  year: string,
  locks: MonthLockInfo[],
  now: { year: string; month: string }
): string[] {
  const y = Number(year);
  const nowYear = Number(now.year);
  if (y > nowYear) return [];
  const lastMonth = y === nowYear ? Number(now.month) : 12;
  const isCurrentYear = y === nowYear;

  const synced = new Set(
    locks
      .filter(
        (l) =>
          l.status === "no_allocation" ||
          (l.status === "synced_locked" && (l.storedCount === undefined || l.storedCount > 0))
      )
      .map((l) => String(parseInt(l.month, 10)))
  );

  const months: string[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const month = String(m);
    if (!synced.has(month) || (isCurrentYear && m === lastMonth)) months.push(month);
  }
  return months;
}

/** Current year/month in IST — the dealers' and the gov portal's calendar. */
export function currentIstYearMonth(now: Date = new Date()): { year: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? String(now.getFullYear());
  const month = parts.find((p) => p.type === "month")?.value ?? String(now.getMonth() + 1);
  return { year, month: String(parseInt(month, 10)) };
}

import { GovApiClient } from "@/server/clients/GovApiClient";
import { mutateWorkbook } from "@/server/clients/BlobXlsxClient";
import {
  BlobTransactionRepository,
  applyTransactionUpserts,
} from "@/server/repositories/blob/BlobTransactionRepository";
import {
  BlobMonthLockRepository,
  applyLockUpsert,
} from "@/server/repositories/blob/BlobMonthLockRepository";
import { DEALER_SHEETS, dealerBlobPath } from "@/server/repositories/blob/dealerWorkbook";
import { SheetCache } from "@/server/cache/SheetCache";
import type { StoredTransaction, MonthLock } from "@/server/repositories/interfaces";
import type { Transaction } from "@/types";

const monthDataCache = new SheetCache<StoredTransaction[]>(5 * 60 * 1000);

function isCurrentMonth(year: string, month: string): boolean {
  const now = new Date();
  return (
    String(now.getFullYear()) === String(year) &&
    String(now.getMonth() + 1) === String(parseInt(month, 10))
  );
}

export interface MonthDataResult {
  transactions: Transaction[];
  source: "gov_api" | "sheet_cache";
  lockStatus: MonthLock["status"];
}

/**
 * Implements the month-lock fetch decision:
 * - Current calendar month: always re-fetch from the gov API, upsert, keep status=live.
 * - Past months: fetch once, lock as synced_locked; afterwards always served from
 *   the Transactions sheet (cached in-memory) without hitting the gov API again.
 * - Lazy rollover: a month that's no longer current but still marked 'live'
 *   flips to 'synced_locked' the next time it's touched.
 */
export class SyncService {
  private govApi = new GovApiClient();
  private txnRepo = new BlobTransactionRepository();
  private lockRepo = new BlobMonthLockRepository();

  async getMonthData(
    distCode: string,
    fpsId: string,
    year: string,
    month: string
  ): Promise<MonthDataResult> {
    const cacheKey = `${year}-${month}`;
    const current = isCurrentMonth(year, month);

    if (current) {
      const result = await this.fetchAndStore(distCode, fpsId, year, month, "live");
      monthDataCache.invalidate(fpsId);
      return { transactions: result, source: "gov_api", lockStatus: "live" };
    }

    let lock = await this.lockRepo.get(fpsId, year, month);

    // Lazy rollover: month no longer current but still marked live.
    if (lock && lock.status === "live") {
      lock = { ...lock, status: "synced_locked" };
      await this.lockRepo.upsert(lock);
    }

    if (lock && lock.status === "synced_locked") {
      const cached = await monthDataCache.getOrLoad(
        fpsId,
        () => this.txnRepo.getForMonth(fpsId, year, month),
        cacheKey
      );
      return { transactions: cached, source: "sheet_cache", lockStatus: "synced_locked" };
    }

    // Never synced before — fetch once and lock.
    const result = await this.fetchAndStore(distCode, fpsId, year, month, "synced_locked");
    monthDataCache.invalidate(fpsId);
    return { transactions: result, source: "gov_api", lockStatus: "synced_locked" };
  }

  private async fetchAndStore(
    distCode: string,
    fpsId: string,
    year: string,
    month: string,
    status: MonthLock["status"]
  ): Promise<Transaction[]> {
    const { transactions } = await this.govApi.fetchTransactions(distCode, fpsId, month, year);

    // Both sheet mutations are applied in a single atomic blob read-modify-
    // write — writing them as two separate sequential repo calls (each with
    // its own read-modify-write cycle against the same blob) risks the
    // second call's read racing ahead of the first write's propagation,
    // silently dropping it.
    await mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      applyTransactionUpserts(wb, fpsId, year, month, transactions, "api");
      applyLockUpsert(wb, {
        fpsId,
        year,
        month,
        status,
        lastSyncedAt: new Date().toISOString(),
        recordCount: transactions.length,
      });
    });

    return transactions;
  }
}

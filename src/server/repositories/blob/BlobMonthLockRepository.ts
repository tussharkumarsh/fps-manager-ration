import type * as XLSX from "xlsx";
import { mutateWorkbook, readWorkbook, rowsToSheet, sheetToRows } from "@/server/clients/BlobXlsxClient";
import type { IMonthLockRepository, MonthLock } from "@/server/repositories/interfaces";
import {
  DEALER_SHEETS,
  MONTH_LOCKS_HEADERS,
  MONTH_LOCKS_SHEET,
  dealerBlobPath,
} from "@/server/repositories/blob/dealerWorkbook";

interface MonthLockRow {
  fps_id?: string | number;
  year?: string | number;
  month?: string | number;
  status?: string;
  last_synced_at?: string;
  record_count?: string | number;
}

function rowToLock(row: MonthLockRow): MonthLock {
  return {
    fpsId: String(row.fps_id ?? "").trim(),
    year: String(row.year ?? "").trim(),
    month: String(row.month ?? "").trim(),
    status: (row.status as MonthLock["status"]) || "live",
    lastSyncedAt: String(row.last_synced_at ?? ""),
    recordCount: parseInt(String(row.record_count ?? "0"), 10) || 0,
  };
}

function lockToRow(lock: MonthLock): MonthLockRow {
  return {
    fps_id: lock.fpsId,
    year: lock.year,
    month: lock.month,
    status: lock.status,
    last_synced_at: lock.lastSyncedAt,
    record_count: lock.recordCount,
  };
}

/**
 * Pure mutation: applies a MonthLock upsert to an in-memory workbook without
 * any I/O — see applyTransactionUpserts for why this is exported (combining
 * multiple sheet mutations into a single atomic blob read-modify-write).
 */
export function applyLockUpsert(wb: XLSX.WorkBook, lock: MonthLock): void {
  const rows = sheetToRows<MonthLockRow>(wb, MONTH_LOCKS_SHEET);
  const idx = rows.findIndex(
    (r) =>
      String(r.fps_id ?? "").trim() === lock.fpsId.trim() &&
      String(r.year ?? "").trim() === String(lock.year).trim() &&
      String(r.month ?? "").trim() === String(lock.month).trim()
  );
  const newRow = lockToRow(lock);
  if (idx === -1) {
    rows.push(newRow);
  } else {
    rows[idx] = newRow;
  }
  rowsToSheet(wb, MONTH_LOCKS_SHEET, rows as unknown as Record<string, unknown>[], MONTH_LOCKS_HEADERS);
}

export class BlobMonthLockRepository implements IMonthLockRepository {
  async get(fpsId: string, year: string, month: string): Promise<MonthLock | null> {
    const wb = await readWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS);
    const rows = sheetToRows<MonthLockRow>(wb, MONTH_LOCKS_SHEET);
    const row = rows.find(
      (r) =>
        String(r.fps_id ?? "").trim() === fpsId.trim() &&
        String(r.year ?? "").trim() === String(year).trim() &&
        String(r.month ?? "").trim() === String(month).trim()
    );
    if (!row) return null;
    return rowToLock(row);
  }

  async upsert(lock: MonthLock): Promise<void> {
    await mutateWorkbook(dealerBlobPath(lock.fpsId), DEALER_SHEETS, (wb) => applyLockUpsert(wb, lock));
  }
}

import type * as XLSX from "xlsx";
import { mutateWorkbook, readWorkbook, rowsToSheet, sheetToRows } from "@/server/clients/BlobXlsxClient";
import type { ITransactionRepository, StoredTransaction } from "@/server/repositories/interfaces";
import type { Transaction } from "@/types";
import {
  DEALER_SHEETS,
  TRANSACTIONS_HEADERS,
  TRANSACTIONS_SHEET,
  dealerBlobPath,
} from "@/server/repositories/blob/dealerWorkbook";

interface TransactionRow {
  row_key?: string;
  fps_id?: string | number;
  year?: string | number;
  month?: string | number;
  slNo?: string | number;
  srcNo?: string;
  scheme?: string;
  availType?: string;
  receiptNo?: string;
  date?: string;
  wheat?: string | number;
  rice?: string | number;
  saree?: string | number;
  amount?: string | number;
  portability?: string;
  authTransTime?: string;
  fetched_at?: string;
  source?: string;
}

function rowKey(fpsId: string, year: string, month: string, receiptNo: string): string {
  return `${fpsId}_${year}_${month}_${receiptNo}`;
}

function rowToTxn(row: TransactionRow): StoredTransaction {
  return {
    id: String(row.receiptNo ?? ""),
    fpsId: String(row.fps_id ?? "").trim(),
    year: String(row.year ?? ""),
    month: String(row.month ?? ""),
    slNo: parseInt(String(row.slNo ?? "0"), 10) || 0,
    srcNo: String(row.srcNo ?? ""),
    scheme: (row.scheme as Transaction["scheme"]) || "PHH",
    availType: (row.availType as Transaction["availType"]) || "Authenticated",
    receiptNo: String(row.receiptNo ?? ""),
    date: String(row.date ?? ""),
    wheat: parseFloat(String(row.wheat ?? "0")) || 0,
    rice: parseFloat(String(row.rice ?? "0")) || 0,
    saree: parseFloat(String(row.saree ?? "0")) || 0,
    amount: parseFloat(String(row.amount ?? "0")) || 0,
    portability: String(row.portability ?? ""),
    authTransTime: row.authTransTime || undefined,
    fetchedAt: String(row.fetched_at ?? ""),
    source: (row.source as StoredTransaction["source"]) || "api",
  };
}

function txnToRow(
  key: string,
  fpsId: string,
  year: string,
  month: string,
  t: Transaction,
  fetchedAt: string,
  source: "api" | "manual"
): TransactionRow {
  return {
    row_key: key,
    fps_id: fpsId,
    year,
    month,
    slNo: t.slNo,
    srcNo: t.srcNo,
    scheme: t.scheme,
    availType: t.availType,
    receiptNo: t.receiptNo,
    date: t.date,
    wheat: t.wheat,
    rice: t.rice,
    saree: t.saree,
    amount: t.amount,
    portability: t.portability,
    authTransTime: t.authTransTime || "",
    fetched_at: fetchedAt,
    source,
  };
}

/**
 * Pure mutation: applies transaction upserts (deduped by row_key) to an
 * in-memory workbook without any I/O. Exported so callers needing to combine
 * this with other sheet mutations in a single atomic blob read-modify-write
 * (see SyncService) can do so without racing two separate writes.
 */
export function applyTransactionUpserts(
  wb: XLSX.WorkBook,
  fpsId: string,
  year: string,
  month: string,
  txns: Transaction[],
  source: "api" | "manual" = "api"
): number {
  if (txns.length === 0) return 0;
  const rows = sheetToRows<TransactionRow>(wb, TRANSACTIONS_SHEET);
  const keyToIdx = new Map<string, number>();
  rows.forEach((r, idx) => {
    if (r.row_key) keyToIdx.set(r.row_key, idx);
  });

  const fetchedAt = new Date().toISOString();
  let changed = 0;
  for (const t of txns) {
    const key = rowKey(fpsId, year, month, t.receiptNo);
    const newRow = txnToRow(key, fpsId, year, month, t, fetchedAt, source);
    const existingIdx = keyToIdx.get(key);
    if (existingIdx !== undefined) {
      rows[existingIdx] = newRow;
    } else {
      rows.push(newRow);
      keyToIdx.set(key, rows.length - 1);
    }
    changed++;
  }

  rowsToSheet(wb, TRANSACTIONS_SHEET, rows as unknown as Record<string, unknown>[], TRANSACTIONS_HEADERS);
  return changed;
}

export class BlobTransactionRepository implements ITransactionRepository {
  async getForMonth(fpsId: string, year: string, month: string): Promise<StoredTransaction[]> {
    const wb = await readWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS);
    const rows = sheetToRows<TransactionRow>(wb, TRANSACTIONS_SHEET);
    return rows
      .filter(
        (r) =>
          String(r.fps_id ?? "").trim() === fpsId.trim() &&
          String(r.year ?? "").trim() === String(year).trim() &&
          String(r.month ?? "").trim() === String(month).trim()
      )
      .map(rowToTxn);
  }

  async upsertMany(
    fpsId: string,
    year: string,
    month: string,
    txns: Transaction[],
    source: "api" | "manual" = "api"
  ): Promise<number> {
    if (txns.length === 0) return 0;
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) =>
      applyTransactionUpserts(wb, fpsId, year, month, txns, source)
    );
  }
}

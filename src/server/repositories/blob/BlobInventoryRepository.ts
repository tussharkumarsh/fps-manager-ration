import type * as XLSX from "xlsx";
import { mutateWorkbook, readWorkbook, rowsToSheet, sheetToRows } from "@/server/clients/BlobXlsxClient";
import type { IInventoryRepository } from "@/server/repositories/interfaces";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";
import {
  DEALER_SHEETS,
  INVENTORY_ITEMS_HEADERS,
  INVENTORY_ITEMS_SHEET,
  INVENTORY_LEDGER_HEADERS,
  INVENTORY_LEDGER_SHEET,
  dealerBlobPath,
} from "@/server/repositories/blob/dealerWorkbook";

interface ItemRow {
  fps_id?: string;
  item_id?: string;
  name?: string;
  unit?: string;
  tx_field?: string;
  active?: string | boolean;
  created_at?: string;
}

interface LedgerRow {
  fps_id?: string;
  year?: string;
  month?: string;
  item_id?: string;
  opening?: string | number;
  received?: string | number;
  distributed_manual?: string | number;
  closing?: string | number;
  updated_at?: string;
}

const DEFAULT_ITEMS: Omit<InventoryItem, "id">[] = [
  { name: "Wheat", unit: "Kg", txField: "wheat", active: true },
  { name: "Rice", unit: "Kg", txField: "rice", active: true },
  { name: "Saree Kit", unit: "Pcs", txField: "", active: true },
];

function rowToItem(row: ItemRow): InventoryItem {
  return {
    id: String(row.item_id ?? ""),
    name: String(row.name ?? ""),
    unit: String(row.unit ?? ""),
    txField: (row.tx_field as InventoryItem["txField"]) || "",
    active: String(row.active ?? "true") !== "false",
  };
}

function itemToRow(fpsId: string, item: InventoryItem): ItemRow {
  return {
    fps_id: fpsId,
    item_id: item.id,
    name: item.name,
    unit: item.unit,
    tx_field: item.txField,
    active: item.active ? "true" : "false",
    created_at: new Date().toISOString(),
  };
}

function rowToLedger(row: LedgerRow): InventoryLedgerEntry {
  return {
    fpsId: String(row.fps_id ?? "").trim(),
    year: String(row.year ?? ""),
    month: String(row.month ?? ""),
    itemId: String(row.item_id ?? ""),
    opening: parseFloat(String(row.opening ?? "0")) || 0,
    received: parseFloat(String(row.received ?? "0")) || 0,
    distributed: parseFloat(String(row.distributed_manual ?? "0")) || 0,
    closing: parseFloat(String(row.closing ?? "0")) || 0,
  };
}

function ledgerToRow(entry: InventoryLedgerEntry): LedgerRow {
  return {
    fps_id: entry.fpsId,
    year: entry.year,
    month: entry.month,
    item_id: entry.itemId,
    opening: entry.opening,
    received: entry.received,
    distributed_manual: entry.distributed,
    closing: entry.closing,
    updated_at: new Date().toISOString(),
  };
}

/** Returns the previous (year, month) as strings, handling January -> December rollover. */
function previousMonth(year: string, month: string): { year: string; month: string } {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (m <= 1) return { year: String(y - 1), month: "12" };
  return { year: String(y), month: String(m - 1) };
}

function generateItemId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Seeds the default item set for a dealer if no items exist yet for that fps_id. */
function ensureDefaultItems(wb: XLSX.WorkBook, fpsId: string): ItemRow[] {
  const rows = sheetToRows<ItemRow>(wb, INVENTORY_ITEMS_SHEET);
  const hasAny = rows.some((r) => String(r.fps_id ?? "").trim() === fpsId.trim());
  if (hasAny) return rows;

  const seeded = [...rows];
  for (const item of DEFAULT_ITEMS) {
    seeded.push(itemToRow(fpsId, { ...item, id: generateItemId() }));
  }
  rowsToSheet(wb, INVENTORY_ITEMS_SHEET, seeded as unknown as Record<string, unknown>[], INVENTORY_ITEMS_HEADERS);
  return seeded;
}

/** Finds an item's stored closing balance for (year, month), or 0 if no row exists yet. */
function closingFor(wb: XLSX.WorkBook, fpsId: string, year: string, month: string, itemId: string): number {
  const rows = sheetToRows<LedgerRow>(wb, INVENTORY_LEDGER_SHEET);
  const row = rows.find(
    (r) =>
      String(r.fps_id ?? "").trim() === fpsId.trim() &&
      String(r.year ?? "").trim() === String(year).trim() &&
      String(r.month ?? "").trim() === String(month).trim() &&
      String(r.item_id ?? "").trim() === itemId.trim()
  );
  return row ? parseFloat(String(row.closing ?? "0")) || 0 : 0;
}

function upsertLedgerRow(wb: XLSX.WorkBook, entry: InventoryLedgerEntry): void {
  const rows = sheetToRows<LedgerRow>(wb, INVENTORY_LEDGER_SHEET);
  const idx = rows.findIndex(
    (r) =>
      String(r.fps_id ?? "").trim() === entry.fpsId.trim() &&
      String(r.year ?? "").trim() === String(entry.year).trim() &&
      String(r.month ?? "").trim() === String(entry.month).trim() &&
      String(r.item_id ?? "").trim() === entry.itemId.trim()
  );
  const newRow = ledgerToRow(entry);
  if (idx === -1) {
    rows.push(newRow);
  } else {
    rows[idx] = newRow;
  }
  rowsToSheet(wb, INVENTORY_LEDGER_SHEET, rows as unknown as Record<string, unknown>[], INVENTORY_LEDGER_HEADERS);
}

export class BlobInventoryRepository implements IInventoryRepository {
  async getItems(fpsId: string): Promise<InventoryItem[]> {
    const wb = await readWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS);
    const existing = sheetToRows<ItemRow>(wb, INVENTORY_ITEMS_SHEET);
    const hasAny = existing.some((r) => String(r.fps_id ?? "").trim() === fpsId.trim());
    if (hasAny) {
      return existing
        .filter((r) => String(r.fps_id ?? "").trim() === fpsId.trim())
        .map(rowToItem);
    }

    // No items yet for this dealer — seed the defaults, once.
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (freshWb) => {
      const rows = ensureDefaultItems(freshWb, fpsId);
      return rows
        .filter((r) => String(r.fps_id ?? "").trim() === fpsId.trim())
        .map(rowToItem);
    });
  }

  async addItem(fpsId: string, item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
    const newItem: InventoryItem = { ...item, id: generateItemId() };
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      ensureDefaultItems(wb, fpsId);
      const rows = sheetToRows<ItemRow>(wb, INVENTORY_ITEMS_SHEET);
      rows.push(itemToRow(fpsId, newItem));
      rowsToSheet(wb, INVENTORY_ITEMS_SHEET, rows as unknown as Record<string, unknown>[], INVENTORY_ITEMS_HEADERS);
      return newItem;
    });
  }

  async getLedgerForMonth(fpsId: string, year: string, month: string): Promise<InventoryLedgerEntry[]> {
    const wb = await readWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS);
    const rows = sheetToRows<LedgerRow>(wb, INVENTORY_LEDGER_SHEET);
    return rows
      .filter(
        (r) =>
          String(r.fps_id ?? "").trim() === fpsId.trim() &&
          String(r.year ?? "").trim() === String(year).trim() &&
          String(r.month ?? "").trim() === String(month).trim()
      )
      .map(rowToLedger);
  }

  async setReceived(
    fpsId: string,
    year: string,
    month: string,
    itemId: string,
    received: number,
    distributed: number
  ): Promise<InventoryLedgerEntry> {
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      const prev = previousMonth(year, month);
      const opening = closingFor(wb, fpsId, prev.year, prev.month, itemId);
      const closing = opening + received - distributed;
      const entry: InventoryLedgerEntry = { fpsId, year, month, itemId, opening, received, distributed, closing };
      upsertLedgerRow(wb, entry);
      return entry;
    });
  }

  async setManualDistributed(
    fpsId: string,
    year: string,
    month: string,
    itemId: string,
    distributed: number
  ): Promise<InventoryLedgerEntry> {
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      const rows = sheetToRows<LedgerRow>(wb, INVENTORY_LEDGER_SHEET);
      const existing = rows.find(
        (r) =>
          String(r.fps_id ?? "").trim() === fpsId.trim() &&
          String(r.year ?? "").trim() === String(year).trim() &&
          String(r.month ?? "").trim() === String(month).trim() &&
          String(r.item_id ?? "").trim() === itemId.trim()
      );
      const prev = previousMonth(year, month);
      const opening = existing ? parseFloat(String(existing.opening ?? "0")) || 0 : closingFor(wb, fpsId, prev.year, prev.month, itemId);
      const received = existing ? parseFloat(String(existing.received ?? "0")) || 0 : 0;
      const closing = opening + received - distributed;
      const entry: InventoryLedgerEntry = { fpsId, year, month, itemId, opening, received, distributed, closing };
      upsertLedgerRow(wb, entry);
      return entry;
    });
  }
}

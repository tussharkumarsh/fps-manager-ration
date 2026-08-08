import { mutateWorkbook, readWorkbook, rowsToSheet, sheetToRows } from "@/server/clients/BlobXlsxClient";
import type { ICustomerRepository } from "@/server/repositories/interfaces";
import type { Customer } from "@/types";
import {
  CUSTOMERS_HEADERS,
  CUSTOMERS_SHEET,
  DEALER_SHEETS,
  dealerBlobPath,
} from "@/server/repositories/blob/dealerWorkbook";

interface CustomerRow {
  fps_id?: string;
  srcNo?: string;
  name?: string;
  last_dispatched?: string;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    srcNo: String(row.srcNo ?? ""),
    name: String(row.name ?? ""),
    lastDispatched: row.last_dispatched || undefined,
  };
}

function customerToRow(fpsId: string, c: Customer): CustomerRow {
  return {
    fps_id: fpsId,
    srcNo: c.srcNo,
    name: c.name,
    last_dispatched: c.lastDispatched || "",
  };
}

export class BlobCustomerRepository implements ICustomerRepository {
  async getAll(fpsId: string): Promise<Customer[]> {
    const wb = await readWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS);
    const rows = sheetToRows<CustomerRow>(wb, CUSTOMERS_SHEET);
    return rows
      .filter((r) => String(r.fps_id ?? "").trim() === fpsId.trim())
      .map(rowToCustomer);
  }

  async upsertMany(fpsId: string, customers: Customer[]): Promise<number> {
    if (customers.length === 0) return 0;
    return mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      const rows = sheetToRows<CustomerRow>(wb, CUSTOMERS_SHEET);
      const keyToIdx = new Map<string, number>();
      rows.forEach((r, idx) => {
        if (String(r.fps_id ?? "").trim() === fpsId.trim() && r.srcNo) {
          keyToIdx.set(r.srcNo, idx);
        }
      });

      let changed = 0;
      for (const c of customers) {
        const newRow = customerToRow(fpsId, c);
        const existingIdx = keyToIdx.get(c.srcNo);
        if (existingIdx !== undefined) {
          rows[existingIdx] = newRow;
        } else {
          rows.push(newRow);
          keyToIdx.set(c.srcNo, rows.length - 1);
        }
        changed++;
      }
      rowsToSheet(wb, CUSTOMERS_SHEET, rows as unknown as Record<string, unknown>[], CUSTOMERS_HEADERS);
      return changed;
    });
  }

  async add(fpsId: string, customer: Customer): Promise<void> {
    await this.upsertMany(fpsId, [customer]);
  }

  async remove(fpsId: string, srcNo: string): Promise<void> {
    await mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      const rows = sheetToRows<CustomerRow>(wb, CUSTOMERS_SHEET);
      const filtered = rows.filter(
        (r) => !(String(r.fps_id ?? "").trim() === fpsId.trim() && r.srcNo === srcNo)
      );
      rowsToSheet(wb, CUSTOMERS_SHEET, filtered as unknown as Record<string, unknown>[], CUSTOMERS_HEADERS);
    });
  }
}

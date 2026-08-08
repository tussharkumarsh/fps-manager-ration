import type * as XLSX from "xlsx";
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
  scheme?: string;
  s_no?: string | number;
  area_type?: string;
  status?: string;
  member_count?: string | number;
  mobile?: string;
  family_head?: string;
  members_json?: string;
}

function rowToCustomer(row: CustomerRow): Customer {
  let members: Customer["members"];
  if (row.members_json) {
    try {
      members = JSON.parse(row.members_json);
    } catch {
      members = undefined;
    }
  }
  return {
    srcNo: String(row.srcNo ?? ""),
    name: String(row.name ?? ""),
    lastDispatched: row.last_dispatched || undefined,
    scheme: (row.scheme as Customer["scheme"]) || undefined,
    sNo: row.s_no ? parseInt(String(row.s_no), 10) || undefined : undefined,
    areaType: row.area_type || undefined,
    status: row.status || undefined,
    memberCount: row.member_count ? parseInt(String(row.member_count), 10) || undefined : undefined,
    mobile: row.mobile || undefined,
    familyHead: row.family_head || undefined,
    members,
  };
}

function customerToRow(fpsId: string, c: Customer): CustomerRow {
  return {
    fps_id: fpsId,
    srcNo: c.srcNo,
    name: c.name,
    last_dispatched: c.lastDispatched || "",
    scheme: c.scheme || "",
    s_no: c.sNo ?? "",
    area_type: c.areaType || "",
    status: c.status || "",
    member_count: c.memberCount ?? "",
    mobile: c.mobile || "",
    family_head: c.familyHead || "",
    members_json: c.members && c.members.length > 0 ? JSON.stringify(c.members) : "",
  };
}

/** Merges an incoming customer onto an existing row — only overwrites fields the incoming record actually provides, so enrichment imports don't blank out data set by an earlier import. */
function mergeRow(existing: CustomerRow, incoming: Customer, fpsId: string): CustomerRow {
  const incomingRow = customerToRow(fpsId, incoming);
  const merged: CustomerRow = { ...existing };
  for (const key of Object.keys(incomingRow) as (keyof CustomerRow)[]) {
    const value = incomingRow[key];
    if (value !== "" && value !== undefined && value !== null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/** Pure mutation: removes every customer row belonging to this fps_id. */
export function applyClearCustomers(wb: XLSX.WorkBook, fpsId: string): void {
  const rows = sheetToRows<CustomerRow>(wb, CUSTOMERS_SHEET);
  const remaining = rows.filter((r) => String(r.fps_id ?? "").trim() !== fpsId.trim());
  rowsToSheet(wb, CUSTOMERS_SHEET, remaining as unknown as Record<string, unknown>[], CUSTOMERS_HEADERS);
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
        const existingIdx = keyToIdx.get(c.srcNo);
        if (existingIdx !== undefined) {
          rows[existingIdx] = mergeRow(rows[existingIdx], c, fpsId);
        } else {
          rows.push(customerToRow(fpsId, c));
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

  async clearAll(fpsId: string): Promise<void> {
    await mutateWorkbook(dealerBlobPath(fpsId), DEALER_SHEETS, (wb) => {
      applyClearCustomers(wb, fpsId);
    });
  }
}

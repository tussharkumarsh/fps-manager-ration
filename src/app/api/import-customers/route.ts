import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { isBeneficiaryDrillDownSheet, parseBeneficiaryDrillDown } from "@/lib/beneficiaryParser";
import type { Customer } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
// Large imports (hundreds of customers) upsert-then-verify against the
// backend, which itself round-trips to Supabase twice on a mismatch —
// the platform's default 10s function timeout isn't enough headroom.
export const maxDuration = 60;

function looksLikeBeneficiaryDrillDown(workbook: XLSX.WorkBook): boolean {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", range: 0 }).slice(0, 20) as unknown[][];
  return rows.some((r) => isBeneficiaryDrillDownSheet(r));
}

function parseKgsMaster(workbook: XLSX.WorkBook): { customers: Customer[]; sheetName: string } {
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes("master")) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const customers: Customer[] = [];
  for (const row of rows) {
    const srcNo = String(
      row["SRCNo"] || row["SRC No"] || row["srcNo"] || row["SRC_No"] || ""
    ).trim();
    const name = String(
      row["Name"] || row["name"] || row["Customer Name"] || row["CustomerName"] || ""
    ).trim();
    const lastDispatched = String(
      row["Last_Dispatched"] || row["LastDispatched"] || row["Last Dispatched"] || ""
    ).trim();

    if (srcNo && srcNo !== "undefined" && srcNo !== "NaN") {
      customers.push({
        srcNo,
        name: name || "Unknown",
        lastDispatched: lastDispatched !== "NaN" ? lastDispatched : undefined,
      });
    }
  }
  return { customers, sheetName };
}

// Vercel Serverless Functions reject request bodies over ~4.5MB (a fixed
// platform limit, not something raise-able via config) — a beneficiary
// drill-down import with hundreds of customers, each carrying a full
// family-members array, can exceed that in a single request. Splitting by
// estimated JSON byte size (rather than a fixed customer count) keeps
// every chunk well under the limit regardless of how much per-customer
// data a given file happens to carry.
const MAX_CHUNK_BYTES = 3_000_000;

function chunkBySize(customers: Customer[]): Customer[][] {
  const chunks: Customer[][] = [];
  let current: Customer[] = [];
  let currentBytes = 0;

  for (const c of customers) {
    const size = JSON.stringify(c).length;
    if (current.length > 0 && currentBytes + size > MAX_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(c);
    currentBytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Imports in size-bounded chunks, sequentially (not in parallel) so
 * concurrent writes to the same dealer can't race each other's
 * upsert-then-verify cycle in TransactionService.importCustomers.
 */
async function importInChunks(fpsId: string, customers: Customer[]): Promise<number> {
  const chunks = chunkBySize(customers);
  let savedCount = 0;
  for (const chunk of chunks) {
    const { savedCount: chunkSaved } = await backendFetch<{ savedCount: number }>("/customers/import", {
      method: "POST",
      body: { fpsId, customers: chunk },
    });
    savedCount += chunkSaved;
  }
  return savedCount;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    let workbook: XLSX.WorkBook;
    let customers: Customer[];
    let sheetName: string;
    let format: "beneficiary_drilldown" | "kgs_master";

    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: "array" });

      if (looksLikeBeneficiaryDrillDown(workbook)) {
        format = "beneficiary_drilldown";
        sheetName = workbook.SheetNames[0];
        customers = parseBeneficiaryDrillDown(workbook);
      } else {
        format = "kgs_master";
        const parsed = parseKgsMaster(workbook);
        customers = parsed.customers;
        sheetName = parsed.sheetName;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: `Failed to parse Excel: ${message}` }, { status: 400 });
    }

    try {
      const savedCount = await importInChunks(session.fpsId, customers);
      return NextResponse.json({
        success: true,
        customers,
        count: customers.length,
        savedCount,
        sheetName,
        format,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: `Parsed ${customers.length} customer(s) but failed to save them to storage: ${message}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

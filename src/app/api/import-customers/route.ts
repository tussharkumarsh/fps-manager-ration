import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { isBeneficiaryDrillDownSheet, parseBeneficiaryFile } from "@/lib/beneficiaryParser";
import type { BeneficiaryImport, Customer } from "@/types";

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
async function importInChunks(
  fpsId: string,
  customers: Customer[],
  importedAt?: string
): Promise<{ savedCount: number; newCards: number; updatedCards: number }> {
  const chunks = chunkBySize(customers);
  const total = { savedCount: 0, newCards: 0, updatedCards: 0 };
  for (const chunk of chunks) {
    const r = await backendFetch<{ savedCount: number; newCards?: number; updatedCards?: number }>(
      "/customers/import",
      { method: "POST", body: { fpsId, customers: chunk, ...(importedAt ? { importedAt } : {}) } }
    );
    total.savedCount += r.savedCount;
    total.newCards += r.newCards ?? 0;
    total.updatedCards += r.updatedCards ?? 0;
  }
  return total;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role === "admin") {
    return NextResponse.json({ error: "Admin view is read-only" }, { status: 403 });
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
    let beneficiary: ReturnType<typeof parseBeneficiaryFile> | null = null;

    try {
      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: "array" });

      if (looksLikeBeneficiaryDrillDown(workbook)) {
        format = "beneficiary_drilldown";
        sheetName = workbook.SheetNames[0];
        beneficiary = parseBeneficiaryFile(workbook);
        customers = beneficiary.customers;
        if (!beneficiary.meta) {
          return NextResponse.json(
            { error: "This file has no \"FPS Detail\" line, so it can't tell which FPS it belongs to." },
            { status: 400 }
          );
        }
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
      if (beneficiary?.meta) {
        // One upload = one stamp: every card it touches gets this time, and
        // the summary row records it after all chunks are in.
        const importedAt = new Date().toISOString();
        const { savedCount, newCards, updatedCards } = await importInChunks(session.fpsId, customers, importedAt);
        const { import: upload } = await backendFetch<{ import: BeneficiaryImport }>("/customers/imports", {
          method: "POST",
          body: {
            fpsId: session.fpsId,
            upload: {
              ...beneficiary.meta,
              fileName: file.name || "",
              importedAt,
              cards: customers.length,
              members: customers.reduce((s, c) => s + (c.memberCount || 0), 0),
              aayCards: customers.filter((c) => c.scheme === "AAY").length,
              phhCards: customers.filter((c) => c.scheme === "PHH").length,
              footer: beneficiary.footer,
              newCards,
              updatedCards,
            },
          },
        });
        return NextResponse.json({
          success: true,
          format,
          sheetName,
          count: customers.length,
          savedCount,
          meta: beneficiary.meta,
          newCards,
          updatedCards,
          missingCards: upload.missingCards,
          importedAt,
        });
      }

      const { savedCount } = await importInChunks(session.fpsId, customers);
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

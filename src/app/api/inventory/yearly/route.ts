import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Full-year, monthwise ledger for a single dealer — the collective
 * (all-dealers) view doesn't support this yet, since a monthwise table
 * combining every dealer's item set has no single coherent shape.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  if (!year) {
    return NextResponse.json({ error: "year is required" }, { status: 400 });
  }

  const viewFpsId = searchParams.get("viewFpsId");
  if (session.role === "admin" && !viewFpsId) {
    return NextResponse.json(
      { error: "Select a dealer from the Dealers page to view their monthwise ledger." },
      { status: 400 }
    );
  }

  try {
    const dealer = await resolveEffectiveDealer(session, viewFpsId);
    const data = await backendFetch<{ items: InventoryItem[]; monthly: Record<string, InventoryLedgerEntry[]> }>(
      "/inventory/yearly",
      { query: { fpsId: dealer.fpsId, year } }
    );
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

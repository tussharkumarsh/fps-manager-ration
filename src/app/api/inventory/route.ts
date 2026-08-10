import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  try {
    const viewFpsId = searchParams.get("viewFpsId");

    // Admin with no specific dealer selected sees every dealer's inventory
    // ledger combined for this month — the "collective view".
    if (session.role === "admin" && !viewFpsId) {
      const data = await backendFetch<{
        rows: (InventoryLedgerEntry & { dealerName: string; itemName: string; unit: string })[];
      }>("/inventory/all-dealers", { query: { year, month } });
      return NextResponse.json({ success: true, ...data });
    }

    const dealer = await resolveEffectiveDealer(session, viewFpsId);
    const data = await backendFetch<{ items: InventoryItem[]; ledger: InventoryLedgerEntry[] }>("/inventory", {
      query: { fpsId: dealer.fpsId, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deletes every inventory item and ledger entry for the signed-in user.
 * Always scoped to session.fpsId — never accepts an fps_id from the
 * request, so this can only ever affect the caller's own data.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await backendFetch("/inventory", { method: "DELETE", query: { fpsId: session.fpsId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

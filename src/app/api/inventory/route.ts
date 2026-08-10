import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { InventoryService } from "@/server/services/InventoryService";

// Reads/writes Vercel Blob storage and must never be statically cached.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const inventoryService = new InventoryService();

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
    const { items, ledger } = await inventoryService.getMonthLedger(session.fpsId, year, month);
    return NextResponse.json({ success: true, items, ledger });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

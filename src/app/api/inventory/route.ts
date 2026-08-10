import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
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
    const data = await backendFetch<{ items: InventoryItem[]; ledger: InventoryLedgerEntry[] }>("/inventory", {
      query: { fpsId: session.fpsId, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { InventoryLedgerEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { year, month, balances } = await req.json();
    if (!year || !month || !Array.isArray(balances)) {
      return NextResponse.json({ error: "year, month and balances[] are required" }, { status: 400 });
    }

    const data = await backendFetch<{ entries: InventoryLedgerEntry[] }>("/inventory/opening-balances", {
      method: "POST",
      body: { fpsId: session.fpsId, year, month, balances },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import type { InventoryLedgerEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = apiRoute(async (req, session) => {
  const { year, month, itemId, received, distributed } = await req.json();
  if (!year || !month || !itemId) {
    return NextResponse.json({ error: "year, month and itemId are required" }, { status: 400 });
  }
  if (received === undefined && distributed === undefined) {
    return NextResponse.json({ error: "received or distributed is required" }, { status: 400 });
  }

  const data = await backendFetch<{ entry: InventoryLedgerEntry }>("/inventory/ledger", {
    method: "POST",
    body: { fpsId: session.fpsId, year, month, itemId, received, distributed },
  });
  return NextResponse.json({ success: true, ...data });
});

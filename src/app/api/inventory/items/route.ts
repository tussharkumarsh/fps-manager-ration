import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import type { InventoryItem } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const POST = apiRoute(async (req, session) => {
  const { name, unit } = await req.json();
  if (!name || !unit) {
    return NextResponse.json({ error: "name and unit are required" }, { status: 400 });
  }
  const data = await backendFetch<{ item: InventoryItem }>("/inventory/items", {
    method: "POST",
    body: { fpsId: session.fpsId, name, unit },
  });
  return NextResponse.json({ success: true, ...data });
});

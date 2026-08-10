import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { InventoryItem } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { name, unit } = await req.json();
    if (!name || !unit) {
      return NextResponse.json({ error: "name and unit are required" }, { status: 400 });
    }
    const data = await backendFetch<{ item: InventoryItem }>("/inventory/items", {
      method: "POST",
      body: { fpsId: session.fpsId, name, unit },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

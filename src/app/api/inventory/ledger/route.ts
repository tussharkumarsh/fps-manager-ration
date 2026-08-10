import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { InventoryService } from "@/server/services/InventoryService";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const inventoryService = new InventoryService();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { year, month, itemId, received, distributed } = await req.json();
    if (!year || !month || !itemId) {
      return NextResponse.json({ error: "year, month and itemId are required" }, { status: 400 });
    }

    let entry;
    if (received !== undefined) {
      entry = await inventoryService.setReceived(session.fpsId, year, month, itemId, Number(received) || 0);
    } else if (distributed !== undefined) {
      entry = await inventoryService.setManualDistributed(
        session.fpsId,
        year,
        month,
        itemId,
        Number(distributed) || 0
      );
    } else {
      return NextResponse.json({ error: "received or distributed is required" }, { status: 400 });
    }

    return NextResponse.json({ success: true, entry });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

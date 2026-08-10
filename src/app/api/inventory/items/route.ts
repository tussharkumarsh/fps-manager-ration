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
    const { name, unit } = await req.json();
    if (!name || !unit) {
      return NextResponse.json({ error: "name and unit are required" }, { status: 400 });
    }
    const item = await inventoryService.addItem(session.fpsId, {
      name,
      unit,
      txField: "",
      active: true,
    });
    return NextResponse.json({ success: true, item });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { GovStockRegisterEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
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
    const dealer = await resolveEffectiveDealer(session, viewFpsId);
    const data = await backendFetch<{ entries: GovStockRegisterEntry[] }>("/inventory/gov-stock", {
      query: { fpsId: dealer.fpsId, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { year, month, viewFpsId } = await req.json();
    if (!year || !month) {
      return NextResponse.json({ error: "year and month are required" }, { status: 400 });
    }
    const dealer = await resolveEffectiveDealer(session, viewFpsId ?? null);
    const data = await backendFetch<{ entries: GovStockRegisterEntry[] }>("/inventory/gov-stock/sync", {
      method: "POST",
      body: { fpsId: dealer.fpsId, distCode: dealer.distCode, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

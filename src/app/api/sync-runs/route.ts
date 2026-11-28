import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { SyncRun } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** The dealer's recent nightly auto-sync jobs (an admin may pass ?viewFpsId=). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const viewFpsId = new URL(req.url).searchParams.get("viewFpsId");
    if (session.role === "admin" && !viewFpsId) return NextResponse.json({ success: true, runs: [] });
    const dealer = await resolveEffectiveDealer(session, viewFpsId);
    const data = await backendFetch<{ runs: SyncRun[] }>("/transactions/sync-runs", { query: { fpsId: dealer.fpsId } });
    return NextResponse.json({ success: true, runs: data.runs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

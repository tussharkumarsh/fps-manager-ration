import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { SyncRun } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** The dealer's recent nightly auto-sync jobs (an admin may pass ?viewFpsId=). */
export const GET = apiRoute(async (req, session) => {
  const viewFpsId = new URL(req.url).searchParams.get("viewFpsId");
  if (session.role === "admin" && !viewFpsId) return NextResponse.json({ success: true, runs: [] });
  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ runs: SyncRun[] }>("/transactions/sync-runs", { query: { fpsId: dealer.fpsId } });
  return NextResponse.json({ success: true, runs: data.runs });
});

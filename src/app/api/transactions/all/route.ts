import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { Transaction } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Returns every transaction already stored for the signed-in user, across
 * all months — a pure read, never calls the gov API. Used to hydrate a
 * session (any browser/device) with previously synced data immediately.
 * An admin may pass ?viewFpsId= to read another dealer's data this way.
 */
export const GET = apiRoute(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const viewFpsId = searchParams.get("viewFpsId");

  // Admin with no specific dealer selected sees every dealer's
  // transactions combined — the "collective view" across all FPS accounts.
  if (session.role === "admin" && !viewFpsId) {
    const data = await backendFetch<{
      transactions: (Transaction & { fpsId: string; dealerName: string })[];
      count: number;
    }>("/transactions/all-dealers");
    return NextResponse.json({ success: true, ...data });
  }

  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ transactions: Transaction[]; count: number }>("/transactions/all", {
    query: { fpsId: dealer.fpsId },
  });
  return NextResponse.json({ success: true, ...data });
});

/**
 * Deletes every transaction (and their month locks) stored for the
 * signed-in user. Always scoped to session.fpsId.
 */
export const DELETE = apiRoute(async (_req, session) => {
  await backendFetch("/transactions/all", {
    method: "DELETE",
    query: { fpsId: session.fpsId },
  });
  return NextResponse.json({ success: true });
});

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { Transaction } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Reads transactions for a given month/year, scoped to the authenticated
 * user's FPS ID — always served from Supabase, never the gov API. The gov
 * API is only ever called by the Sync page's explicit "Fetch and Parse"
 * (see /api/fetch-transactions), so viewing data here never triggers a
 * live fetch, no matter how many times it's read.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!month || !year) {
    return NextResponse.json(
      { error: "Missing required query params: month, year" },
      { status: 400 }
    );
  }

  try {
    const dealer = await resolveEffectiveDealer(session, searchParams.get("viewFpsId"));
    const viewingOther = dealer.fpsId !== session.fpsId;
    const data = await backendFetch<{
      transactions: Transaction[];
      count: number;
      source: string;
      lockStatus: string;
    }>("/transactions", {
      query: {
        fpsId: dealer.fpsId,
        distCode: dealer.distCode,
        year,
        month,
        readOnly: viewingOther ? "true" : undefined,
      },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

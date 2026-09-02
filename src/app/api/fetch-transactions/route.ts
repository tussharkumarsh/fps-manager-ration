import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { Transaction } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Triggers a sync for the given month/year, scoped to the authenticated
 * user's FPS ID (never trusts a client-supplied fps_id). District code
 * comes from the user's session record.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { month, year } = await req.json();

    if (!month || !year) {
      return NextResponse.json(
        { error: "Missing required fields: month, year" },
        { status: 400 }
      );
    }

    const data = await backendFetch<{
      transactions: Transaction[];
      count: number;
      source: string;
      lockStatus: string;
    }>("/transactions", {
      // An explicit "Fetch and Parse" click is a deliberate request for the
      // latest data — always hit the gov API for the current (live) month
      // rather than serving the short-lived cache (which auto-load relies
      // on for silent background loads).
      query: {
        fpsId: session.fpsId,
        distCode: session.distCode,
        year: String(year),
        month: String(month),
        forceRefresh: "true",
      },
    });

    return NextResponse.json({
      success: true,
      ...data,
      fetchedAt: new Date().toISOString(),
      params: { distCode: session.distCode, fpsId: session.fpsId, month, year },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch transactions: ${message}` },
      { status: 500 }
    );
  }
}

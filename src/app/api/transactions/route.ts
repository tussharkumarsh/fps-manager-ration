import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SyncService } from "@/server/services/SyncService";

// This route reads Vercel Blob storage on every call and must never be
// statically cached or see a cached fetch response.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const syncService = new SyncService();

/**
 * Reads transactions for a given month/year, scoped to the authenticated
 * user's FPS ID. Uses the same month-lock logic as fetch-transactions:
 * current month always re-syncs from the gov API, past months are served
 * from the Transactions sheet (cached) once locked.
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
    const result = await syncService.getMonthData(session.distCode, session.fpsId, year, month);
    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      count: result.transactions.length,
      source: result.source,
      lockStatus: result.lockStatus,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

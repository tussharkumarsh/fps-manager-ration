import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { SyncService } from "@/server/services/SyncService";

// This route reads/writes Vercel Blob storage on every call and must never
// see a cached response.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const syncService = new SyncService();

/**
 * Triggers a sync for the given month/year, scoped to the authenticated
 * user's FPS ID (never trusts a client-supplied fps_id). District code
 * comes from the user's session record (set when the user was created).
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

    const result = await syncService.getMonthData(
      session.distCode,
      session.fpsId,
      String(year),
      String(month)
    );

    return NextResponse.json({
      success: true,
      transactions: result.transactions,
      count: result.transactions.length,
      source: result.source,
      lockStatus: result.lockStatus,
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

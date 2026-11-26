import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export interface DayTotals {
  date: string;
  cards: number;
  qty: Record<string, number>;
}

export interface DayComparison {
  date: string;
  ok: boolean;
  gov: DayTotals | null;
  ours: DayTotals | null;
  diffs: string[];
}

/**
 * Compares the stored sales of one month, day by day, with the portal's own
 * day-wise totals. Read-only, so an admin may run it for a dealer they're
 * viewing (?viewFpsId=); the FPS/district always come from the server.
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
    return NextResponse.json({ error: "Missing required query params: month, year" }, { status: 400 });
  }

  try {
    const dealer = await resolveEffectiveDealer(session, searchParams.get("viewFpsId"));
    if (session.role === "admin" && dealer.fpsId === session.fpsId) {
      return NextResponse.json({ error: "Select a dealer to verify" }, { status: 400 });
    }
    const data = await backendFetch<{ days: DayComparison[]; matched: number; total: number }>(
      "/transactions/verify",
      { query: { fpsId: dealer.fpsId, distCode: dealer.distCode, year, month } }
    );
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

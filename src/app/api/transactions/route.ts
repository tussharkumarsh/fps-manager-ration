import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { Transaction } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Reads transactions for a given month/year, scoped to the authenticated
 * user's FPS ID. Uses the same month-lock logic as fetch-transactions:
 * current month always re-syncs from the gov API, past months are served
 * from Supabase (cached) once locked.
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
    const data = await backendFetch<{
      transactions: Transaction[];
      count: number;
      source: string;
      lockStatus: string;
    }>("/transactions", {
      query: { fpsId: session.fpsId, distCode: session.distCode, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Which months of a year are already synced for the signed-in dealer —
 * feeds the Sync page's "Sync missing months" backfill. Always scoped to
 * session.fpsId; admins don't sync, so they're refused like the other
 * write flows.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role === "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const year = new URL(req.url).searchParams.get("year");
  if (!year || !/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "year (YYYY) is required" }, { status: 400 });
  }

  try {
    const data = await backendFetch<{
      locks: {
        month: string;
        status: string;
        recordCount: number;
        storedCount: number;
        coveredBy?: { year: string; month: string };
      }[];
    }>(
      "/transactions/locks",
      { query: { fpsId: session.fpsId, year } }
    );
    return NextResponse.json({ success: true, locks: data.locks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

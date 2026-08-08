import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SyncService } from "@/server/services/SyncService";

// Reads Vercel Blob storage and must never be statically cached.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const syncService = new SyncService();

/**
 * Returns every transaction already stored for the signed-in user, across
 * all months — a pure read from the Excel sheet, never calls the gov API.
 * Used to hydrate a session (any browser/device, e.g. after logging in on
 * a new incognito window) with previously synced data immediately.
 */
export async function GET() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const transactions = await syncService.getAllStoredTransactions(session.fpsId);
    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deletes every transaction (and their month locks) stored for the
 * signed-in user. Always scoped to session.fpsId — never accepts an fps_id
 * from the request, so this can only ever affect the caller's own data.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await syncService.clearAllTransactions(session.fpsId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

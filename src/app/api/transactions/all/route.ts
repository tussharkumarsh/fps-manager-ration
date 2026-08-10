import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
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
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const dealer = await resolveEffectiveDealer(session, searchParams.get("viewFpsId"));
    const data = await backendFetch<{ transactions: Transaction[]; count: number }>("/transactions/all", {
      query: { fpsId: dealer.fpsId },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deletes every transaction (and their month locks) stored for the
 * signed-in user. Always scoped to session.fpsId.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await backendFetch("/transactions/all", {
      method: "DELETE",
      query: { fpsId: session.fpsId },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

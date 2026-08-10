import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Admin-only: clears a specific dealer's data — used when onboarding a
 * real client onto an account that was previously used for testing/setup,
 * so they start from a clean slate. Deliberately separate from the
 * regular "view a dealer's data" flow (which is read-only by design) —
 * this is an explicit, confirmed action, never something reachable while
 * just browsing a dealer's data.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fpsId: string }> }) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fpsId } = await params;
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope !== "transactions" && scope !== "customers" && scope !== "all") {
    return NextResponse.json({ error: "scope must be 'transactions', 'customers' or 'all'" }, { status: 400 });
  }

  try {
    if (scope === "all") {
      await backendFetch("/reset-all", { method: "DELETE", query: { fpsId } });
    } else if (scope === "transactions") {
      await backendFetch("/transactions/all", { method: "DELETE", query: { fpsId } });
    } else {
      await backendFetch("/customers", { method: "DELETE", query: { fpsId, all: "true" } });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

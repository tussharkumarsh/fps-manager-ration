import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { UserProfile } from "@/app/api/profile/route";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ fpsId: string }> }) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fpsId } = await params;

  // An admin can't demote or deactivate their own account through this UI —
  // that would risk locking every admin out with no way back in.
  if (fpsId === session.fpsId) {
    return NextResponse.json({ error: "You can't edit your own account here." }, { status: 400 });
  }

  try {
    const { distCode, username, displayName, role, active } = await req.json();
    const data = await backendFetch<{ profile: UserProfile }>(`/auth/users/${encodeURIComponent(fpsId)}`, {
      method: "PATCH",
      body: { distCode, username, displayName, role, active },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ fpsId: string }> }) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fpsId } = await params;

  if (fpsId === session.fpsId) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  try {
    // Clean up the dealer's data before removing the account — otherwise
    // their customers/transactions/month-locks would be orphaned rows tied
    // to an fps_id no account owns anymore.
    await backendFetch("/transactions/all", { method: "DELETE", query: { fpsId } });
    await backendFetch("/customers", { method: "DELETE", query: { fpsId, all: "true" } });
    await backendFetch(`/auth/users/${encodeURIComponent(fpsId)}`, { method: "DELETE" });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

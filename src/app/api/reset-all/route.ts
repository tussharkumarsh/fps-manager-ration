import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Deletes every transaction, month lock, and customer stored for the
 * signed-in user. Always scoped to session.fpsId.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await backendFetch("/reset-all", {
      method: "DELETE",
      query: { fpsId: session.fpsId },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

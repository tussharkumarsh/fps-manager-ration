import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DataResetService } from "@/server/services/DataResetService";

// Writes Vercel Blob storage and must never see a cached fetch response.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const dataResetService = new DataResetService();

/**
 * Deletes every transaction, month lock, and customer stored for the
 * signed-in user. Always scoped to session.fpsId — never accepts an fps_id
 * from the request, so this can only ever affect the caller's own data,
 * never another dealer's (each has their own blob file).
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await dataResetService.resetAll(session.fpsId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

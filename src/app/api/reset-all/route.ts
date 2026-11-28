import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Deletes every transaction, month lock, and customer stored for the
 * signed-in user. Always scoped to session.fpsId.
 */
export const DELETE = apiRoute(async (_req, session) => {
  await backendFetch("/reset-all", {
    method: "DELETE",
    query: { fpsId: session.fpsId },
  });
  return NextResponse.json({ success: true });
});

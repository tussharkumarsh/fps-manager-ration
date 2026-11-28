import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import type { FpsDirectoryEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Stored portal directory entries (owner, terminal, masked mobile, office)
 * for the given FPS numbers: ?ids=151209500218,151209300100. Public portal
 * data, readable by any signed-in user.
 */
export const GET = apiRoute(async (req, session) => {
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{6,20}$/.test(s));
  if (ids.length === 0) return NextResponse.json({ success: true, entries: [] });
  if (ids.length > 500) return NextResponse.json({ error: "Too many ids" }, { status: 400 });
  const data = await backendFetch<{ entries: FpsDirectoryEntry[] }>("/other-shops/directory", {
    query: { ids: ids.join(",") },
  });
  return NextResponse.json({ success: true, entries: data.entries });
});

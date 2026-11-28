import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { ShopProfile } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * The dealer's stored government shop-report profiles for the given FPS
 * numbers (?ids=…). Each dealer sees only what he uploaded; an admin may
 * pass ?viewFpsId= to see a dealer's.
 */
export const GET = apiRoute(async (req, session) => {
  const params = new URL(req.url).searchParams;
  const ids = (params.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{6,20}$/.test(s));
  if (ids.length === 0) return NextResponse.json({ success: true, profiles: [] });
  if (ids.length > 500) return NextResponse.json({ error: "Too many ids" }, { status: 400 });
  const dealer = await resolveEffectiveDealer(session, params.get("viewFpsId"));
  const data = await backendFetch<{ profiles: ShopProfile[] }>("/other-shops/profiles", {
    query: { fpsId: dealer.fpsId, ids: ids.join(",") },
  });
  return NextResponse.json({ success: true, profiles: data.profiles });
});

/** Saves profiles parsed from a shop report (the page keeps only related shops). Dealers only. */
export const POST = apiRoute(async (req, session) => {
  if (session.role === "admin") {
    return NextResponse.json({ error: "Admin view is read-only" }, { status: 403 });
  }
  const body = await req.json();
  if (!Array.isArray(body?.profiles) || body.profiles.length > 500) {
    return NextResponse.json({ error: "profiles[] (at most 500) is required" }, { status: 400 });
  }
  const data = await backendFetch<{ saved: number; skippedOlder: number; rejected: number }>(
    "/other-shops/profiles",
    { method: "POST", body: { fpsId: session.fpsId, profiles: body.profiles } }
  );
  return NextResponse.json({ success: true, ...data });
});

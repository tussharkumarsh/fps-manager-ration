import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { GovStockRegisterEntry } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = apiRoute(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  const viewFpsId = searchParams.get("viewFpsId");
  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ entries: GovStockRegisterEntry[] }>("/inventory/gov-stock", {
    query: { fpsId: dealer.fpsId, year, month },
  });
  return NextResponse.json({ success: true, ...data });
});

export const POST = apiRoute(async (req, session) => {
  // Admins are read-only everywhere else; syncing rewrites a dealer's stored register.
  if (session.role === "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { year, month, viewFpsId } = await req.json();
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }
  const dealer = await resolveEffectiveDealer(session, viewFpsId ?? null);
  const data = await backendFetch<{ entries: GovStockRegisterEntry[] }>("/inventory/gov-stock/sync", {
    method: "POST",
    body: { fpsId: dealer.fpsId, distCode: dealer.distCode, year, month },
  });
  return NextResponse.json({ success: true, ...data });
});

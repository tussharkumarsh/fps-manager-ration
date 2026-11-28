import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { ManualGoshwara } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = apiRoute(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  const dealer = await resolveEffectiveDealer(session, searchParams.get("viewFpsId"));
  const data = await backendFetch<{ goshwara: ManualGoshwara | null }>("/goshwara/manual", {
    query: { fpsId: dealer.fpsId, year, month },
  });
  return NextResponse.json({ success: true, ...data });
});

export const PUT = apiRoute(async (req, session) => {
  const { year, month, entries } = await req.json();
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }
  const data = await backendFetch<{ goshwara: ManualGoshwara }>("/goshwara/manual", {
    method: "PUT",
    body: { fpsId: session.fpsId, year, month, entries },
  });
  return NextResponse.json({ success: true, ...data });
});

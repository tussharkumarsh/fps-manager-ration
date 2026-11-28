import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { FamilyMember } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** One ration card's family members (?srcNo=…), read when its row is opened. */
export const GET = apiRoute(async (req, session) => {
  const params = new URL(req.url).searchParams;
  const srcNo = (params.get("srcNo") || "").trim();
  if (!/^\d{6,20}$/.test(srcNo)) {
    return NextResponse.json({ error: "A ration card number (srcNo) is required" }, { status: 400 });
  }
  // The admin's all-dealers list names each card's dealer: ?viewFpsId= is
  // then that dealer.
  const dealer = await resolveEffectiveDealer(session, params.get("viewFpsId"));
  const data = await backendFetch<{ members: FamilyMember[] }>("/customers/members", {
    query: { fpsId: dealer.fpsId, srcNo },
  });
  return NextResponse.json({ success: true, members: data.members });
});

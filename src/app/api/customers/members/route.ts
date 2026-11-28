import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { FamilyMember } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** One ration card's family members (?srcNo=…), read when its row is opened. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const params = new URL(req.url).searchParams;
  const srcNo = (params.get("srcNo") || "").trim();
  if (!/^\d{6,20}$/.test(srcNo)) {
    return NextResponse.json({ error: "A ration card number (srcNo) is required" }, { status: 400 });
  }
  try {
    // The admin's all-dealers list names each card's dealer: ?viewFpsId= is
    // then that dealer.
    const dealer = await resolveEffectiveDealer(session, params.get("viewFpsId"));
    const data = await backendFetch<{ members: FamilyMember[] }>("/customers/members", {
      query: { fpsId: dealer.fpsId, srcNo },
    });
    return NextResponse.json({ success: true, members: data.members });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

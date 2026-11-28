import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { BeneficiaryImport } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** The latest beneficiary-file upload per source FPS (the FPS-wise summary). */
export const GET = apiRoute(async (req, session) => {
  const viewFpsId = new URL(req.url).searchParams.get("viewFpsId");
  // The admin's all-dealers view has no single dealer to summarise.
  if (session.role === "admin" && !viewFpsId) {
    return NextResponse.json({ success: true, imports: [] });
  }
  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ imports: BeneficiaryImport[] }>("/customers/imports", {
    query: { fpsId: dealer.fpsId },
  });
  return NextResponse.json({ success: true, imports: data.imports });
});

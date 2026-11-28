import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { BeneficiaryImport } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** The latest beneficiary-file upload per source FPS (the FPS-wise summary). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

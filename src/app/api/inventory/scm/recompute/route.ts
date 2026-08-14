import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.fpsId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const { year, viewFpsId } = await req.json();
        if (!year) {
            return NextResponse.json({ error: "year is required" }, { status: 400 });
        }
        const dealer = await resolveEffectiveDealer(session, viewFpsId ?? null);
        await backendFetch("/inventory/scm/recompute", {
            method: "POST",
            body: { fpsId: dealer.fpsId, year },
        });
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

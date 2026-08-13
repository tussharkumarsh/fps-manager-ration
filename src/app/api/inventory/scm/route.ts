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
        const { year, month, viewFpsId, shopNo, districtCode, districtName } = await req.json();
        if (!year || !month) {
            return NextResponse.json({ error: "year and month are required" }, { status: 400 });
        }
        const dealer = await resolveEffectiveDealer(session, viewFpsId ?? null);
        const data = await backendFetch<{ success: boolean; roCount: number; truckChitCount: number; summary: any[]; transactions: any[]; }>("/inventory/scm/sync", {
            method: "POST",
            body: {
                fpsId: dealer.fpsId,
                year,
                month,
                shopNo,
                districtCode: districtCode || dealer.distCode,
                districtName,
            },
        });
        return NextResponse.json({
            ...(data ?? {}),
            success: data?.success ?? true,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.fpsId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get("year");
        const month = searchParams.get("month");
        const viewFpsId = searchParams.get("viewFpsId");
        if (!year || !month) {
            return NextResponse.json({ error: "year and month are required" }, { status: 400 });
        }

        const dealer = await resolveEffectiveDealer(session, viewFpsId ?? null);
        const data = await backendFetch<{ rows: any[]; }>("/inventory/scm/summary", {
            query: { fpsId: dealer.fpsId, year, month },
        });
        return NextResponse.json({ success: true, rows: data.rows || [] });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

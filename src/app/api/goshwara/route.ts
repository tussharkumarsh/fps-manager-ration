import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { ManualGoshwara } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "year and month are required" }, { status: 400 });
  }

  try {
    const dealer = await resolveEffectiveDealer(session, searchParams.get("viewFpsId"));
    const data = await backendFetch<{ goshwara: ManualGoshwara | null }>("/goshwara/manual", {
      query: { fpsId: dealer.fpsId, year, month },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { year, month, entries } = await req.json();
    if (!year || !month) {
      return NextResponse.json({ error: "year and month are required" }, { status: 400 });
    }
    const data = await backendFetch<{ goshwara: ManualGoshwara }>("/goshwara/manual", {
      method: "PUT",
      body: { fpsId: session.fpsId, year, month, entries },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

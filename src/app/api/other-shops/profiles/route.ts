import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { ShopProfile } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Stored government shop-report profiles for the given FPS numbers
 * (?ids=…). Public government data, readable by any signed-in user.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const ids = (new URL(req.url).searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{6,20}$/.test(s));
  if (ids.length === 0) return NextResponse.json({ success: true, profiles: [] });
  if (ids.length > 500) return NextResponse.json({ error: "Too many ids" }, { status: 400 });
  try {
    const data = await backendFetch<{ profiles: ShopProfile[] }>("/other-shops/profiles", {
      query: { ids: ids.join(",") },
    });
    return NextResponse.json({ success: true, profiles: data.profiles });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Saves profiles parsed from a shop report (the page keeps only related shops). Dealers only. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role === "admin") {
    return NextResponse.json({ error: "Admin view is read-only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (!Array.isArray(body?.profiles) || body.profiles.length > 500) {
      return NextResponse.json({ error: "profiles[] (at most 500) is required" }, { status: 400 });
    }
    const data = await backendFetch<{ saved: number; skippedOlder: number; rejected: number }>(
      "/other-shops/profiles",
      { method: "POST", body: { profiles: body.profiles } }
    );
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

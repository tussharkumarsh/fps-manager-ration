import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Fetches one AFSO office's shop list from the gov portal and stores it —
 * a live portal call, only ever made from the Other Shops page's explicit
 * "Fetch from portal" button. Body: { officeCode: "1512095" }.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const { officeCode } = await req.json();
    if (typeof officeCode !== "string" || !/^\d{7}$/.test(officeCode.trim())) {
      return NextResponse.json({ error: "A 7-digit office code is required" }, { status: 400 });
    }
    const data = await backendFetch<{ officeCode: string; count: number }>("/other-shops/directory/sync", {
      method: "POST",
      body: { officeCode: officeCode.trim() },
    });
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import type { UserProfile } from "@/app/api/profile/route";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await backendFetch<{ users: UserProfile[] }>("/auth/users");
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { fpsId, distCode, username, password, displayName } = await req.json();
    if (!fpsId || !distCode || !username || !password || !displayName) {
      return NextResponse.json(
        { error: "fpsId, distCode, username, password and displayName are required" },
        { status: 400 }
      );
    }
    // Always created as a dealer — this endpoint can't be used to mint more admins.
    await backendFetch("/auth/users", {
      method: "POST",
      body: { fpsId, distCode, username, password, displayName, role: "dealer" },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

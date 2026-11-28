import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import type { UserProfile } from "@/app/api/profile/route";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = apiRoute(async (_req, session) => {
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await backendFetch<{ users: UserProfile[] }>("/auth/users");
  return NextResponse.json({ success: true, ...data });
});

export const POST = apiRoute(async (req, session) => {
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
});

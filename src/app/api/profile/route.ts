import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export interface UserProfile {
  fpsId: string;
  distCode: string;
  username: string;
  displayName: string;
  role: "dealer" | "admin";
  createdAt: string;
  active: boolean;
}

export const GET = apiRoute(async (_req, session) => {
  const data = await backendFetch<{ profile: UserProfile }>("/auth/profile", {
    query: { fpsId: session.fpsId },
  });
  return NextResponse.json({ success: true, ...data });
});

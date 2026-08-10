import { backendFetch } from "@/server/backendClient";

export interface EffectiveDealer {
  fpsId: string;
  distCode: string;
}

/**
 * Read-only routes accept an optional ?viewFpsId= so an admin can browse
 * another dealer's data. Only ever honored for role="admin" sessions — a
 * dealer session always resolves to their own fpsId/distCode regardless of
 * what's in the query string, so a dealer can never read another dealer's
 * data by tampering with the request.
 *
 * distCode is looked up server-side from the target dealer's own profile
 * rather than trusted from the client, since the admin's own distCode
 * would otherwise silently leak into the wrong dealer's data.
 */
export async function resolveEffectiveDealer(
  session: { fpsId: string; distCode: string; role: string },
  requestedFpsId: string | null
): Promise<EffectiveDealer> {
  if (session.role === "admin" && requestedFpsId && requestedFpsId !== session.fpsId) {
    const data = await backendFetch<{ profile: { fpsId: string; distCode: string } | null }>("/auth/profile", {
      query: { fpsId: requestedFpsId },
    });
    if (!data.profile) {
      throw new Error(`No such dealer: ${requestedFpsId}`);
    }
    return { fpsId: data.profile.fpsId, distCode: data.profile.distCode };
  }
  return { fpsId: session.fpsId, distCode: session.distCode };
}

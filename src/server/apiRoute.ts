import type { NextRequest } from "next/server";

/** The signed-in account, as every API route needs it. */
export interface RouteSession {
  fpsId: string;
  distCode: string;
  role: "dealer" | "admin";
}

/**
 * Builds the wrapper every API route handler uses: answers 401 when nobody
 * is signed in, passes the session to the handler, and turns any thrown
 * error into a JSON 500 with its message. `getSession` is injected so this
 * stays testable; routes use `apiRoute` from "@/server/route".
 */
export function makeApiRoute<S extends RouteSession>(getSession: () => Promise<S | null | undefined>) {
  return function apiRoute<C = unknown>(
    handler: (req: NextRequest, session: S, ctx: C) => Promise<Response>
  ): (req: NextRequest, ctx: C) => Promise<Response> {
    return async (req, ctx) => {
      const session = await getSession();
      if (!session?.fpsId) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
      }
      try {
        return await handler(req, session, ctx);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return Response.json({ error: message }, { status: 500 });
      }
    };
  };
}

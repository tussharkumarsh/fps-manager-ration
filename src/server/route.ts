import { auth } from "@/auth";
import { makeApiRoute } from "./apiRoute";

/**
 * Wraps an API route handler: 401 without a session, the session passed in,
 * thrown errors answered as JSON 500. See makeApiRoute.
 */
export const apiRoute = makeApiRoute(async () => {
  const session = await auth();
  return session?.fpsId ? session : null;
});

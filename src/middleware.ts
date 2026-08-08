import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Uses the edge-safe config only (no Credentials provider, no Node-only
// deps like bcrypt/xlsx/the Blob SDK) — middleware runs on the Edge Runtime
// by default and cannot load those. This checks the session cookie/JWT only;
// actual credential verification happens in the Node.js runtime (src/auth.ts).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

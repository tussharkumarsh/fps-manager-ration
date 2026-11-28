import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Next.js 16 "proxy" (formerly middleware): runs before every matched
// request and only checks the session cookie/JWT, so it uses the light
// auth config (no Credentials provider, no bcrypt). Credential checks stay
// in src/auth.ts.
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

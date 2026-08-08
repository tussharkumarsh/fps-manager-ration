import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the NextAuth config — no providers, no Node-only
 * imports (bcrypt, xlsx, the Blob SDK). This is what middleware.ts uses,
 * since Next.js middleware runs on the Edge Runtime by default and cannot
 * load those dependencies. The full config (src/auth.ts) adds the
 * Credentials provider and is used everywhere else (API routes, server
 * components), which run on the Node.js runtime.
 */
export default {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login" || pathname.startsWith("/api/auth")) return true;
      return !!auth;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

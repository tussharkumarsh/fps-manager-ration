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
  // Required for deployments where the host isn't known at build time
  // (e.g. Vercel) — without this, Auth.js rejects the request's Host header
  // and every /api/auth/* call (including the sign-in flow) fails with a
  // 500 UntrustedHost error.
  trustHost: true,
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

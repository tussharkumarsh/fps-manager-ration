import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuthService } from "@/server/services/AuthService";
import authConfig from "@/auth.config";

declare module "next-auth" {
  interface Session {
    fpsId: string;
    distCode: string;
    role: "dealer" | "admin";
    displayName: string;
  }
  interface User {
    fpsId: string;
    distCode: string;
    role: "dealer" | "admin";
    displayName: string;
  }
}

interface AppToken {
  fpsId?: string;
  distCode?: string;
  role?: "dealer" | "admin";
  displayName?: string;
  [key: string]: unknown;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        identifier: { label: "Login ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!identifier || !password) return null;

        const authService = new AuthService();
        const result = await authService.verifyCredentials(identifier, password);
        if (!result) return null;

        return {
          id: result.fpsId,
          fpsId: result.fpsId,
          distCode: result.distCode,
          role: result.role,
          displayName: result.displayName,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      const t = token as AppToken;
      if (user) {
        t.fpsId = user.fpsId;
        t.distCode = user.distCode;
        t.role = user.role;
        t.displayName = user.displayName;
      }
      return t;
    },
    async session({ session, token }) {
      const t = token as AppToken;
      session.fpsId = t.fpsId || "";
      session.distCode = t.distCode || "";
      session.role = t.role || "dealer";
      session.displayName = t.displayName || "";
      return session;
    },
  },
});

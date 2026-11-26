import { backendFetch } from "@/server/backendClient";

export interface AuthResult {
  fpsId: string;
  distCode: string;
  role: "dealer" | "admin";
  displayName: string;
}

export class AuthService {
  /**
   * Returns "locked" when the backend has temporarily blocked this account
   * from this client IP after too many failed attempts.
   */
  async verifyCredentials(
    identifier: string,
    password: string,
    clientIp?: string
  ): Promise<AuthResult | null | "locked"> {
    const data = await backendFetch<{ success: boolean; result: AuthResult | null; locked?: boolean }>(
      "/auth/verify",
      {
        method: "POST",
        body: { identifier, password, clientIp },
      }
    );
    if (data.locked) return "locked";
    return data.result;
  }
}

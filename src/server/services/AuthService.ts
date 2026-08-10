import { backendFetch } from "@/server/backendClient";

export interface AuthResult {
  fpsId: string;
  distCode: string;
  role: "dealer" | "admin";
  displayName: string;
}

export class AuthService {
  async verifyCredentials(identifier: string, password: string): Promise<AuthResult | null> {
    const data = await backendFetch<{ success: boolean; result: AuthResult | null }>("/auth/verify", {
      method: "POST",
      body: { identifier, password },
    });
    return data.result;
  }
}

/**
 * CLI onboarding helper: creates/updates a user via the
 * fps-manager-ration-backend service (Supabase-backed), so there is no
 * manual DB editing needed.
 *
 * Requires BACKEND_URL and INTERNAL_API_KEY to be set — loaded from
 * `.env.local`, and must match the backend's own INTERNAL_API_KEY.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts <fps_id> <dist_code> <username> <password> <display_name> [role]
 *
 * `role` defaults to "dealer" (pass "admin" for an admin user).
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const [fpsId, distCode, username, password, displayName, role] = process.argv.slice(2);

  if (!fpsId || !distCode || !username || !password || !displayName) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts <fps_id> <dist_code> <username> <password> <display_name> [role]"
    );
    console.error('  role defaults to "dealer" (pass "admin" for an admin user).');
    process.exit(1);
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  const internalKey = process.env.INTERNAL_API_KEY || "";

  const res = await fetch(new URL("/auth/users", backendUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
    body: JSON.stringify({
      fpsId,
      distCode,
      username,
      password,
      displayName,
      role: role === "admin" ? "admin" : "dealer",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Backend request failed with status ${res.status}`);
  }

  console.log(`User "${username}" (fps_id=${fpsId}) written to Supabase.`);
  console.log("You can now log in with that fps_id (or username) and password.");
}

main().catch((err) => {
  console.error("Failed to create user:", err);
  process.exit(1);
});

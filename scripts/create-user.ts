/**
 * CLI onboarding helper: hashes a password and writes/updates the
 * corresponding row directly in the `data/users.xlsx` blob (via
 * AuthService), so there is no manual spreadsheet editing needed.
 *
 * Requires BLOB_READ_WRITE_TOKEN to be set — loaded from `.env.local`.
 *
 * Usage:
 *   npx tsx scripts/create-user.ts <fps_id> <dist_code> <username> <password> <display_name> [role]
 *
 * `role` defaults to "dealer" (pass "admin" for an admin user).
 */
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { AuthService } from "../src/server/services/AuthService";

async function main() {
  const [fpsId, distCode, username, password, displayName, role] = process.argv.slice(2);

  if (!fpsId || !distCode || !username || !password || !displayName) {
    console.error(
      "Usage: npx tsx scripts/create-user.ts <fps_id> <dist_code> <username> <password> <display_name> [role]"
    );
    console.error('  role defaults to "dealer" (pass "admin" for an admin user).');
    process.exit(1);
  }

  const svc = new AuthService();
  await svc.createOrUpdateUser({
    fpsId,
    distCode,
    username,
    password,
    displayName,
    role: role === "admin" ? "admin" : "dealer",
  });

  console.log(`User "${username}" (fps_id=${fpsId}) written to data/users.xlsx.`);
  console.log("You can now log in with that fps_id (or username) and password.");
}

main().catch((err) => {
  console.error("Failed to write user:", err);
  process.exit(1);
});

import { mutateWorkbook, readWorkbook, rowsToSheet, sheetToRows } from "@/server/clients/BlobXlsxClient";
import type { AppUser, IUserRepository } from "@/server/repositories/interfaces";
import { USERS_BLOB_PATH, USERS_HEADERS, USERS_SHEET, USERS_SHEETS } from "@/server/repositories/blob/dealerWorkbook";

interface UserRow {
  fps_id?: string;
  dist_code?: string;
  username?: string;
  password_hash?: string;
  display_name?: string;
  role?: string;
  created_at?: string;
  active?: string | boolean;
}

function rowToUser(row: UserRow): AppUser {
  return {
    fpsId: String(row.fps_id ?? "").trim(),
    distCode: String(row.dist_code ?? "").trim(),
    username: String(row.username ?? "").trim(),
    passwordHash: String(row.password_hash ?? ""),
    displayName: String(row.display_name ?? ""),
    role: (row.role as AppUser["role"]) || "dealer",
    createdAt: String(row.created_at ?? ""),
    active: String(row.active).toUpperCase() === "TRUE" || row.active === true,
  };
}

function userToRow(user: AppUser): UserRow {
  return {
    fps_id: user.fpsId,
    dist_code: user.distCode,
    username: user.username,
    password_hash: user.passwordHash,
    display_name: user.displayName,
    role: user.role,
    created_at: user.createdAt,
    active: user.active ? "TRUE" : "FALSE",
  };
}

export class BlobUserRepository implements IUserRepository {
  async findByFpsId(fpsId: string): Promise<AppUser | null> {
    const wb = await readWorkbook(USERS_BLOB_PATH, USERS_SHEETS);
    const rows = sheetToRows<UserRow>(wb, USERS_SHEET);
    const row = rows.find(
      (r) =>
        String(r.fps_id ?? "").trim() === fpsId.trim() ||
        String(r.username ?? "").trim() === fpsId.trim()
    );
    if (!row) return null;
    return rowToUser(row);
  }

  async upsert(user: AppUser): Promise<void> {
    await mutateWorkbook(USERS_BLOB_PATH, USERS_SHEETS, (wb) => {
      const rows = sheetToRows<UserRow>(wb, USERS_SHEET);
      const idx = rows.findIndex((r) => String(r.fps_id ?? "").trim() === user.fpsId.trim());
      const newRow = userToRow(user);
      if (idx === -1) {
        rows.push(newRow);
      } else {
        rows[idx] = newRow;
      }
      rowsToSheet(wb, USERS_SHEET, rows as unknown as Record<string, unknown>[], USERS_HEADERS);
    });
  }
}

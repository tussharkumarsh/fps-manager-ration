/**
 * Shared layout for the single per-dealer workbook: one blob at
 * `data/{fps_id}.xlsx` holding three sheets (Transactions, MonthLocks,
 * Customers). All dealer repositories mutate the same blob, so they share
 * this sheet/header definition to make sure any repo's read-modify-write
 * cycle preserves the other two sheets untouched.
 */
export const TRANSACTIONS_SHEET = "Transactions";
export const MONTH_LOCKS_SHEET = "MonthLocks";
export const CUSTOMERS_SHEET = "Customers";

export const TRANSACTIONS_HEADERS = [
  "row_key",
  "fps_id",
  "year",
  "month",
  "slNo",
  "srcNo",
  "scheme",
  "availType",
  "receiptNo",
  "date",
  "wheat",
  "rice",
  "saree",
  "amount",
  "portability",
  "authTransTime",
  "fetched_at",
  "source",
];

export const MONTH_LOCKS_HEADERS = [
  "fps_id",
  "year",
  "month",
  "status",
  "last_synced_at",
  "record_count",
];

export const CUSTOMERS_HEADERS = [
  "fps_id",
  "srcNo",
  "name",
  "last_dispatched",
  "scheme",
  "s_no",
  "area_type",
  "status",
  "member_count",
  "mobile",
  "family_head",
  "members_json",
];

export const DEALER_SHEETS = [
  { name: TRANSACTIONS_SHEET, headers: TRANSACTIONS_HEADERS },
  { name: MONTH_LOCKS_SHEET, headers: MONTH_LOCKS_HEADERS },
  { name: CUSTOMERS_SHEET, headers: CUSTOMERS_HEADERS },
];

export function dealerBlobPath(fpsId: string): string {
  return `data/${fpsId}.xlsx`;
}

export const USERS_BLOB_PATH = "data/users.xlsx";
export const USERS_SHEET = "Users";
export const USERS_HEADERS = [
  "fps_id",
  "dist_code",
  "username",
  "password_hash",
  "display_name",
  "role",
  "created_at",
  "active",
];
export const USERS_SHEETS = [{ name: USERS_SHEET, headers: USERS_HEADERS }];

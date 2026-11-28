import type { Transaction } from "@/types";

/**
 * The FPS number a transaction's ration card belongs to when it isn't this
 * shop's own (the ePOS portability column), or "" for the shop's own cards
 * ("Self" or blank). The one place this rule lives.
 */
export function homeFpsOf(t: Pick<Transaction, "portability">): string {
  const p = (t.portability || "").trim();
  return p && p.toLowerCase() !== "self" ? p : "";
}

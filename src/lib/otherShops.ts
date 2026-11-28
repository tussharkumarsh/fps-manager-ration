import type { Customer, FpsDirectoryEntry, OtherShop, Transaction } from "@/types";
import { isOwnCard, legacyOtherShopCards } from "./familySummary";

/**
 * The FPS number a transaction's ration card belongs to when it isn't this
 * shop's own (the ePOS portability column), or "" for the shop's own cards.
 */
export function homeFpsOf(t: Pick<Transaction, "portability">): string {
  const p = (t.portability || "").trim();
  return p && p.toLowerCase() !== "self" ? p : "";
}

/**
 * The name to show for another shop: the shop name the dealer saved, else
 * the owner name from the portal directory, else "".
 */
export function shopDisplayName(
  fpsId: string,
  shops: Map<string, OtherShop>,
  directory?: Map<string, FpsDirectoryEntry>
): string {
  return shops.get(fpsId)?.shopName || directory?.get(fpsId)?.ownerName || "";
}

/** "151209500218 · Ram Ration Shop" — or just the number when no name is known. */
export function shopLabel(
  fpsId: string,
  shops: Map<string, OtherShop>,
  directory?: Map<string, FpsDirectoryEntry>
): string {
  const name = shopDisplayName(fpsId, shops, directory);
  return name ? `${fpsId} · ${name}` : fpsId;
}

export interface SeenShop {
  shopFpsId: string;
  /** Distinct ration cards of that shop served here. */
  families: number;
  transactions: number;
  /** "YYYY-MM-DD HH:mm" of the latest transaction. */
  lastDate: string;
}

/**
 * Every other shop whose cards collected here, from the portability column
 * of the transactions (the shop's own Customer Master cards are skipped,
 * whatever the column says), newest activity first. With `dealerFpsId`,
 * master cards that came from another FPS's file don't count as own.
 */
export function seenOtherShops(transactions: Transaction[], customers: Customer[], dealerFpsId?: string): SeenShop[] {
  const ownCards = customers.filter((c) => !dealerFpsId || isOwnCard(c, dealerFpsId));
  // Old master cards whose transactions now name another FPS belong to it.
  const elsewhere = dealerFpsId ? legacyOtherShopCards(ownCards, transactions) : new Set<string>();
  const own = new Set(ownCards.map((c) => c.srcNo).filter((id) => !elsewhere.has(id)));
  const byShop = new Map<string, { cards: Set<string>; transactions: number; lastDate: string }>();
  for (const t of transactions) {
    const fps = homeFpsOf(t);
    if (!fps || own.has(t.srcNo)) continue;
    let s = byShop.get(fps);
    if (!s) byShop.set(fps, (s = { cards: new Set(), transactions: 0, lastDate: "" }));
    s.cards.add(t.srcNo);
    s.transactions++;
    if (t.date > s.lastDate) s.lastDate = t.date;
  }
  return Array.from(byShop.entries())
    .map(([shopFpsId, s]) => ({ shopFpsId, families: s.cards.size, transactions: s.transactions, lastDate: s.lastDate }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.shopFpsId.localeCompare(b.shopFpsId));
}

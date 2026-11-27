import type { Customer, OtherShop, Transaction } from "@/types";

/**
 * The FPS number a transaction's ration card belongs to when it isn't this
 * shop's own (the ePOS portability column), or "" for the shop's own cards.
 */
export function homeFpsOf(t: Pick<Transaction, "portability">): string {
  const p = (t.portability || "").trim();
  return p && p.toLowerCase() !== "self" ? p : "";
}

/** "151209500218 · Ram Ration Shop" — or just the number when no name is saved. */
export function shopLabel(fpsId: string, shops: Map<string, OtherShop>): string {
  const name = shops.get(fpsId)?.shopName;
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
 * of the transactions (cards in the shop's own Customer Master are skipped,
 * whatever the column says), newest activity first.
 */
export function seenOtherShops(transactions: Transaction[], customers: Customer[]): SeenShop[] {
  const own = new Set(customers.map((c) => c.srcNo));
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

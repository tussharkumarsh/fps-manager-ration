import type { Transaction } from "@/types";

/** How a period's transactions split across families: single visits vs repeat visits. */
export interface TransactionBreakdown {
  transactions: number;
  /** Distinct ration cards. */
  families: number;
  /** Families with exactly one transaction. */
  singleFamilies: number;
  /** Families with two or more transactions. */
  multiFamilies: number;
  /** Transactions of the multi-transaction families. */
  multiTransactions: number;
  /** Transactions beyond one per family (transactions - families). */
  extraTransactions: number;
  /** Number of transactions -> how many families had that many (e.g. { 1: 382, 2: 32 }). */
  byCount: Record<number, number>;
}

const ITEM_FIELDS = ["wheat", "rice", "sugar", "jowar", "saree"] as const;
export type ItemField = (typeof ITEM_FIELDS)[number];

export interface MultiTransactionFamily {
  srcNo: string;
  scheme: "PHH" | "AAY";
  /** Home FPS from the portability column ("" for this shop's own cards). */
  homeFps: string;
  /** The family's transactions, oldest first. */
  transactions: Transaction[];
  /** Items that appear in more than one of the family's transactions. */
  repeatedItems: ItemField[];
  /** Per-item totals across the family's transactions (non-zero items only). */
  totals: Partial<Record<ItemField, number>>;
}

function groupBySrcNo(transactions: Transaction[]): Map<string, Transaction[]> {
  const by = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = by.get(t.srcNo);
    if (list) list.push(t);
    else by.set(t.srcNo, [t]);
  }
  return by;
}

export function transactionBreakdown(transactions: Transaction[]): TransactionBreakdown {
  const by = groupBySrcNo(transactions);
  const b: TransactionBreakdown = {
    transactions: transactions.length,
    families: by.size,
    singleFamilies: 0,
    multiFamilies: 0,
    multiTransactions: 0,
    extraTransactions: transactions.length - by.size,
    byCount: {},
  };
  for (const list of Array.from(by.values())) {
    b.byCount[list.length] = (b.byCount[list.length] || 0) + 1;
    if (list.length === 1) b.singleFamilies++;
    else {
      b.multiFamilies++;
      b.multiTransactions += list.length;
    }
  }
  return b;
}

/** The items (non-zero quantities) a transaction handed out. */
export function itemsOf(t: Transaction): ItemField[] {
  return ITEM_FIELDS.filter((f) => (t[f] || 0) > 0);
}

/**
 * Families with more than one transaction in the given set, most
 * transactions first. Pass one ration month's transactions to see repeats
 * within that month.
 */
export function multiTransactionFamilies(transactions: Transaction[]): MultiTransactionFamily[] {
  const out: MultiTransactionFamily[] = [];
  for (const [srcNo, list] of Array.from(groupBySrcNo(transactions).entries())) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const seen = new Map<ItemField, number>();
    const totals: Partial<Record<ItemField, number>> = {};
    for (const t of sorted) {
      for (const f of itemsOf(t)) {
        seen.set(f, (seen.get(f) || 0) + 1);
        totals[f] = (totals[f] || 0) + t[f];
      }
    }
    const latest = sorted[sorted.length - 1];
    const portability = (latest.portability || "").trim();
    out.push({
      srcNo,
      scheme: latest.scheme === "AAY" ? "AAY" : "PHH",
      homeFps: portability && portability.toLowerCase() !== "self" ? portability : "",
      transactions: sorted,
      repeatedItems: ITEM_FIELDS.filter((f) => (seen.get(f) || 0) > 1),
      totals,
    });
  }
  return out.sort((a, b) => b.transactions.length - a.transactions.length || a.srcNo.localeCompare(b.srcNo));
}

import type { Customer, Transaction } from "@/types";
import { rationMonth } from "./utils";

/**
 * The Customer Master cards that have at least one transaction in the
 * given (full, all-months) transaction list. Cards that never took ration
 * are left out of the dealer's customer list and every family count.
 * With no transactions loaded there is nothing to check against, so the
 * master is returned as is (still limited to own cards when `dealerFpsId`
 * is given).
 */
export function customersWithTransactions(
  customers: Customer[],
  transactions: Transaction[],
  dealerFpsId?: string
): Customer[] {
  const own = dealerFpsId ? customers.filter((c) => isOwnCard(c, dealerFpsId)) : customers;
  if (transactions.length === 0) return own;
  const seen = new Set(transactions.map((t) => t.srcNo));
  return own.filter((c) => seen.has(c.srcNo));
}

/**
 * A card of the dealer's own FPS: its beneficiary file named that FPS, or
 * it was imported before files recorded a source. Cards from another FPS's
 * file stay in the master (for names) but never count in the dealer's
 * own figures.
 */
export function isOwnCard(c: Customer, dealerFpsId: string): boolean {
  return !c.sourceFpsId || c.sourceFpsId === dealerFpsId;
}

/** A family count split by scheme. */
export interface SchemeCount {
  total: number;
  phh: number;
  aay: number;
}

export interface OtherShopFamily {
  srcNo: string;
  name?: string;
  scheme: "PHH" | "AAY";
  /** FPS the ration card belongs to (the transaction's portability column), when known. */
  homeFps: string;
  transactions: number;
}

export interface DisabledFamily {
  customer: Customer;
  scheme: "PHH" | "AAY";
  transactions: number;
}

export interface FamilySummary {
  /** Active (not disabled) families in Customer Master. */
  registered: SchemeCount;
  /** Active registered families with at least one transaction in the period. */
  collected: SchemeCount;
  /** Active registered families with no transaction in the period. */
  pending: SchemeCount;
  pendingCustomers: (Customer & { scheme: "PHH" | "AAY" })[];
  /** Cards of other shops (portability column names another FPS) that took ration here. */
  otherShop: SchemeCount;
  otherShopFamilies: OtherShopFamily[];
  /**
   * This shop's own cards (portability "Self") that took ration but are
   * missing from Customer Master — e.g. new cards issued after the import.
   */
  unlisted: SchemeCount;
  unlistedFamilies: OtherShopFamily[];
  /** Disabled Customer Master families that still took ration here. */
  disabledServed: SchemeCount;
  disabledFamilies: DisabledFamily[];
  /** Every distinct family served in the period: collected + other-shop + unlisted + disabled. */
  servedByScheme: SchemeCount;
  transactions: number;
}

const zero = (): SchemeCount => ({ total: 0, phh: 0, aay: 0 });

function add(count: SchemeCount, scheme: "PHH" | "AAY") {
  count.total++;
  if (scheme === "AAY") count.aay++;
  else count.phh++;
}

function normScheme(s: string | undefined): "PHH" | "AAY" | undefined {
  const v = (s || "").trim().toUpperCase();
  return v === "AAY" ? "AAY" : v === "PHH" ? "PHH" : undefined;
}

/**
 * Family-level summary of a set of transactions against Customer Master.
 *
 * Every figure counts distinct ration cards (families), never transactions:
 * a family that collected in several visits, or in several months of the
 * period, counts once. Registered families take their scheme from Customer
 * Master; families not in the master fall back to the scheme on their
 * latest transaction.
 */
export function familySummary(transactions: Transaction[], customers: Customer[]): FamilySummary {
  const master = new Map(customers.map((c) => [c.srcNo, c]));

  // srcNo -> transactions in the period, the latest one (for scheme), and
  // the home FPS from the latest transaction that names one.
  const served = new Map<string, { count: number; latest: Transaction; homeFps: string; homeDate: string }>();
  for (const t of transactions) {
    const port = (t.portability || "").trim();
    const home = port && port.toLowerCase() !== "self" ? port : "";
    const prev = served.get(t.srcNo);
    if (!prev) {
      served.set(t.srcNo, { count: 1, latest: t, homeFps: home, homeDate: home ? t.date : "" });
      continue;
    }
    prev.count++;
    if (t.date > prev.latest.date) prev.latest = t;
    if (home && t.date >= prev.homeDate) {
      prev.homeFps = home;
      prev.homeDate = t.date;
    }
  }

  const s: FamilySummary = {
    registered: zero(),
    collected: zero(),
    pending: zero(),
    pendingCustomers: [],
    otherShop: zero(),
    otherShopFamilies: [],
    unlisted: zero(),
    unlistedFamilies: [],
    disabledServed: zero(),
    disabledFamilies: [],
    servedByScheme: zero(),
    transactions: transactions.length,
  };

  for (const c of customers) {
    if (c.disabled) continue;
    const hit = served.get(c.srcNo);
    const scheme = normScheme(c.scheme) ?? normScheme(hit?.latest.scheme) ?? "PHH";
    add(s.registered, scheme);
    if (hit) {
      add(s.collected, scheme);
      add(s.servedByScheme, scheme);
    } else {
      add(s.pending, scheme);
      s.pendingCustomers.push({ ...c, scheme });
    }
  }

  for (const [srcNo, hit] of Array.from(served.entries())) {
    const c = master.get(srcNo);
    if (c && !c.disabled) continue;
    if (c) {
      const scheme = normScheme(c.scheme) ?? normScheme(hit.latest.scheme) ?? "PHH";
      add(s.disabledServed, scheme);
      add(s.servedByScheme, scheme);
      s.disabledFamilies.push({ customer: c, scheme, transactions: hit.count });
    } else {
      const scheme = normScheme(hit.latest.scheme) ?? "PHH";
      add(s.servedByScheme, scheme);
      const family = { srcNo, name: hit.latest.customerName, scheme, homeFps: hit.homeFps, transactions: hit.count };
      if (hit.homeFps) {
        add(s.otherShop, scheme);
        s.otherShopFamilies.push(family);
      } else {
        add(s.unlisted, scheme);
        s.unlistedFamilies.push(family);
      }
    }
  }

  s.otherShopFamilies.sort((a, b) => a.homeFps.localeCompare(b.homeFps) || a.srcNo.localeCompare(b.srcNo));
  s.unlistedFamilies.sort((a, b) => a.srcNo.localeCompare(b.srcNo));
  s.pendingCustomers.sort((a, b) => a.scheme.localeCompare(b.scheme) || a.name.localeCompare(b.name));
  return s;
}

/** One familySummary per ration month ("YYYY-MM") present in the transactions, newest first. */
export function monthlyFamilySummary(
  transactions: Transaction[],
  customers: Customer[]
): { month: string; summary: FamilySummary }[] {
  const byMonth = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const ym = rationMonth(t);
    const list = byMonth.get(ym);
    if (list) list.push(t);
    else byMonth.set(ym, [t]);
  }
  return Array.from(byMonth.keys())
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({ month, summary: familySummary(byMonth.get(month)!, customers) }));
}

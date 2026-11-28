import type { Customer, Transaction } from "@/types";
import { rationMonth } from "./utils";
import { homeFpsOf } from "./portability";

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
  if (!dealerFpsId) {
    if (transactions.length === 0) return customers;
    const seen = new Set(transactions.map((t) => t.srcNo));
    return customers.filter((c) => seen.has(c.srcNo));
  }
  const own = customers.filter((c) => isOwnCard(c, dealerFpsId));
  if (transactions.length === 0) return own;
  const seen = new Set(transactions.map((t) => t.srcNo));
  const elsewhere = legacyOtherShopCards(own, transactions);
  return own.filter((c) => seen.has(c.srcNo) && !elsewhere.has(c.srcNo));
}

/**
 * The cards of the dealer's latest uploaded government beneficiary file
 * for his own FPS (every card stamped with that upload's time), or null
 * when he has not uploaded one.
 */
export function latestOwnFileCards(customers: Customer[], dealerFpsId: string): Customer[] | null {
  const fileCards = customers.filter((c) => c.sourceFpsId === dealerFpsId && c.portalSyncedAt);
  if (fileCards.length === 0) return null;
  const latest = Math.max(...fileCards.map((c) => Date.parse(c.portalSyncedAt!)));
  return fileCards.filter((c) => Date.parse(c.portalSyncedAt!) === latest);
}

/**
 * The dealer's real customers. Once he has uploaded his own beneficiary
 * file, they are exactly the cards of its latest upload — transacted or not,
 * active or disabled. Before that, the master cards with a transaction
 * (see customersWithTransactions).
 */
export function myCustomers(customers: Customer[], transactions: Transaction[], dealerFpsId: string): Customer[] {
  return latestOwnFileCards(customers, dealerFpsId) ?? customersWithTransactions(customers, transactions, dealerFpsId);
}

/**
 * Own master cards left out of the dealer's list: in "file" mode those not
 * in his latest own file; in "transactions" mode those with no transaction.
 */
export function hiddenFromMaster(
  customers: Customer[],
  transactions: Transaction[],
  dealerFpsId: string
): { count: number; mode: "file" | "transactions" } {
  const file = latestOwnFileCards(customers, dealerFpsId);
  if (!file) return { count: hiddenWithoutTransactions(customers, transactions, dealerFpsId), mode: "transactions" };
  const kept = new Set(file.map((c) => c.srcNo));
  return { count: customers.filter((c) => isOwnCard(c, dealerFpsId) && !kept.has(c.srcNo)).length, mode: "file" };
}

/** Own cards left out of the dealer's list because they have no transaction. */
export function hiddenWithoutTransactions(
  customers: Customer[],
  transactions: Transaction[],
  dealerFpsId: string
): number {
  const seen = new Set(transactions.map((t) => t.srcNo));
  return customers.filter((c) => isOwnCard(c, dealerFpsId) && !seen.has(c.srcNo)).length;
}

/**
 * Old master cards (no government file confirms them: empty source) whose
 * latest transaction names another FPS in its portability column. They are
 * that FPS's cards, kept in the master by an earlier import, and count as
 * other-shop families. A card the dealer's own file lists stays his,
 * whatever the column says.
 */
export function legacyOtherShopCards(customers: Customer[], transactions: Transaction[]): Set<string> {
  const legacy = new Set(customers.filter((c) => !c.sourceFpsId).map((c) => c.srcNo));
  const latest = new Map<string, Transaction>();
  for (const t of transactions) {
    if (!legacy.has(t.srcNo)) continue;
    const prev = latest.get(t.srcNo);
    if (!prev || t.date > prev.date) latest.set(t.srcNo, t);
  }
  const out = new Set<string>();
  for (const [srcNo, t] of Array.from(latest.entries())) if (homeFpsOf(t)) out.add(srcNo);
  return out;
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
  /** Disabled families in Customer Master (all registered = registered + this). */
  disabledRegistered: SchemeCount;
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
 *
 * `customers` are the cards that count (the dealer's own). `allCustomers`
 * is the whole master, including other FPSs' cards, and only supplies
 * names for families outside the counted cards (transactions carry none).
 */
export function familySummary(
  transactions: Transaction[],
  customers: Customer[],
  allCustomers: Customer[] = customers
): FamilySummary {
  const master = new Map(customers.map((c) => [c.srcNo, c]));
  const nameOf = new Map(allCustomers.map((c) => [c.srcNo, c.name]));

  // srcNo -> transactions in the period, the latest one (for scheme), and
  // the home FPS from the latest transaction that names one.
  const served = new Map<string, { count: number; latest: Transaction; homeFps: string; homeDate: string }>();
  for (const t of transactions) {
    const home = homeFpsOf(t);
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
    disabledRegistered: zero(),
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
    if (c.disabled) {
      add(s.disabledRegistered, normScheme(c.scheme) ?? normScheme(served.get(c.srcNo)?.latest.scheme) ?? "PHH");
      continue;
    }
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
      const name = nameOf.get(srcNo) || hit.latest.customerName;
      const family = { srcNo, name, scheme, homeFps: hit.homeFps, transactions: hit.count };
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
  customers: Customer[],
  allCustomers: Customer[] = customers
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
    .map((month) => ({ month, summary: familySummary(byMonth.get(month)!, customers, allCustomers) }));
}

"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge, MiniStat } from "@/components/ui";
import { ShopTag } from "@/components/otherShops/ShopDialog";
import { itemsOf, multiTransactionFamilies, transactionBreakdown, type ItemField } from "@/lib/multiTransactions";
import { cn, formatDate, formatNumber, dateOnly, getMonthName, rationMonth } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Customer, Transaction } from "@/types";

type ShopFilter = "ALL" | "OWN" | "OTHER";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${getMonthName(parseInt(m, 10))} ${y}`;
}

/**
 * Families with more than one transaction in a ration month, with every
 * transaction's items — so the month's transaction count can be matched to
 * its family count. Over "All Months", repeats are counted within each month.
 */
export function MultiTransactionReport({
  transactions, customers, scopeLabel, periodLabel,
}: {
  transactions: Transaction[];
  /** All Customer Master families, including disabled ones (for names). */
  customers: Customer[];
  scopeLabel: string;
  periodLabel: string;
}) {
  const { t } = useTranslation();
  const [scheme, setScheme] = useState<"ALL" | "PHH" | "AAY">("ALL");
  const [shopFilter, setShopFilter] = useState<ShopFilter>("ALL");

  const itemLabel: Record<ItemField, string> = {
    wheat: t("transactions.wheat"),
    rice: t("transactions.rice"),
    sugar: t("transactions.sugar"),
    jowar: t("transactions.jowar"),
    saree: t("transactions.saree"),
  };

  const nameOf = useMemo(() => new Map(customers.map((c) => [c.srcNo, c.name])), [customers]);

  const byMonth = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const ym = rationMonth(tx);
      const list = m.get(ym);
      if (list) list.push(tx);
      else m.set(ym, [tx]);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const summary = useMemo(() => {
    const sum = { transactions: 0, families: 0, singleFamilies: 0, multiFamilies: 0, multiTransactions: 0, extraTransactions: 0 };
    for (const [, list] of byMonth) {
      const b = transactionBreakdown(list);
      sum.transactions += b.transactions;
      sum.families += b.families;
      sum.singleFamilies += b.singleFamilies;
      sum.multiFamilies += b.multiFamilies;
      sum.multiTransactions += b.multiTransactions;
      sum.extraTransactions += b.extraTransactions;
    }
    return sum;
  }, [byMonth]);

  const rows = useMemo(() => {
    const out: { month: string; fam: ReturnType<typeof multiTransactionFamilies>[number] }[] = [];
    for (const [month, list] of byMonth) {
      for (const fam of multiTransactionFamilies(list)) {
        if (scheme !== "ALL" && fam.scheme !== scheme) continue;
        if (shopFilter === "OWN" && fam.homeFps) continue;
        if (shopFilter === "OTHER" && !fam.homeFps) continue;
        out.push({ month, fam });
      }
    }
    return out;
  }, [byMonth, scheme, shopFilter]);

  const showMonth = byMonth.length > 1;
  const qty = (n: number) => formatNumber(Math.round(n * 1000) / 1000);

  const tiles = [
    { label: t("otherShops.transactions"), value: summary.transactions, tone: "" },
    { label: t("otherShops.families"), value: summary.families, tone: "" },
    { label: t("reports.singleTxnFamilies"), value: summary.singleFamilies, tone: "text-emerald-700" },
    { label: t("reports.multiTxnFamilies"), value: summary.multiFamilies, tone: "text-amber-600" },
    { label: t("reports.extraTxns"), value: summary.extraTransactions, tone: "text-amber-600" },
  ];

  const pill = (active: boolean) =>
    cn("px-2.5 py-1 rounded-full text-[11px] font-medium border transition",
      active ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50");

  return (
    <div className="space-y-4">
      <div className="no-print card p-5">
        <h3 className="text-sm font-semibold">🔁 {t("reports.multiTxn")}</h3>
        <p className="text-xs text-gray-400 mt-0.5 mb-4">{t("reports.multiTxnSub")}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {tiles.map((x) => (
            <MiniStat key={x.label} label={x.label} value={x.value} tone={x.tone} />
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500 font-mono">
          {t("dashboard.txnEquation", {
            txns: formatNumber(summary.transactions),
            single: formatNumber(summary.singleFamilies),
            multi: formatNumber(summary.multiFamilies),
            multiTxns: formatNumber(summary.multiTransactions),
          })}
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {(["ALL", "PHH", "AAY"] as const).map((s) => (
            <button key={s} onClick={() => setScheme(s)} className={pill(scheme === s)}>
              {s === "ALL" ? t("dashboard.all") : s}
            </button>
          ))}
          <span className="w-2" />
          {(["ALL", "OWN", "OTHER"] as const).map((s) => (
            <button key={s} onClick={() => setShopFilter(s)} className={pill(shopFilter === s)}>
              {s === "ALL" ? t("dashboard.all") : s === "OWN" ? t("reports.ownShop") : t("dashboard.otherShopFamilies")}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()} className="btn-secondary text-xs">🖨️ {t("reports.printReport")}</button>
      </div>

      <div className="card p-5 print:shadow-none print:p-0">
        <div className="hidden print:block text-center mb-3">
          <h3 className="text-base font-bold">{t("reports.multiTxn")}</h3>
          <p className="text-xs">{scopeLabel} · {periodLabel} · {t("dashboard.txnEquation", {
            txns: formatNumber(summary.transactions),
            single: formatNumber(summary.singleFamilies),
            multi: formatNumber(summary.multiFamilies),
            multiTxns: formatNumber(summary.multiTransactions),
          })}</p>
        </div>
        {rows.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">{t("reports.noMultiTxn")}</div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5 print:mx-0 print:px-0">
            <table className="w-full text-xs monthly-dates-table">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  {showMonth && <th className="px-3 py-2 text-left font-semibold">{t("dashboard.month")}</th>}
                  <th className="px-3 py-2 text-left font-semibold">SRC No</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("transactions.customerName")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("transactions.scheme")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("reports.shop")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("transactions.date")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("reports.items")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("reports.repeatedItems")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ month, fam }) => {
                  const span = fam.transactions.length;
                  return (
                    <Fragment key={`${month}-${fam.srcNo}`}>
                      {fam.transactions.map((tx, i) => (
                        <tr key={tx.receiptNo} className={cn("align-top", i === span - 1 && "border-b border-gray-200")}>
                          {i === 0 && (
                            <>
                              {showMonth && <td rowSpan={span} className="px-3 py-2 whitespace-nowrap">{monthLabel(month)}</td>}
                              <td rowSpan={span} className="px-3 py-2 font-mono whitespace-nowrap">{fam.srcNo}</td>
                              <td rowSpan={span} className="px-3 py-2">
                                <div className="font-semibold text-gray-800">{nameOf.get(fam.srcNo) || tx.customerName || "—"}</div>
                                <div className="text-gray-400">{span} {t("reports.txnCount")}</div>
                              </td>
                              <td rowSpan={span} className="px-3 py-2"><Badge text={fam.scheme} /></td>
                              <td rowSpan={span} className="px-3 py-2">
                                {fam.homeFps
                                  ? <ShopTag fps={fam.homeFps} className="text-cyan-800" />
                                  : <span className="text-gray-500">{t("reports.ownShop")}</span>}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                            {formatDate(dateOnly(tx.date))} <span className="text-gray-400">{tx.date.slice(11, 16)}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            {itemsOf(tx).length === 0 ? "—" : itemsOf(tx).map((f) => (
                              <span key={f} className={cn("inline-block mr-2 whitespace-nowrap",
                                fam.repeatedItems.includes(f) && "font-semibold text-amber-700")}>
                                {itemLabel[f]} {qty(tx[f])}
                              </span>
                            ))}
                          </td>
                          {i === 0 && (
                            <td rowSpan={span} className="px-3 py-2">
                              {fam.repeatedItems.length === 0
                                ? <span className="text-gray-400">—</span>
                                : fam.repeatedItems.map((f) => (
                                  <span key={f} className="inline-block mr-1 mb-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium">
                                    {itemLabel[f]} {qty(fam.totals[f] || 0)}
                                  </span>
                                ))}
                            </td>
                          )}
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

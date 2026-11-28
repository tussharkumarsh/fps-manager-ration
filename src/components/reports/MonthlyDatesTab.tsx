"use client";

import { useMemo, useState } from "react";
import { dateOnly, formatDate, getMonthName, rationMonth } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Customer, Transaction } from "@/types";

/**
 * Reports → Monthly Dates: one row per customer, one column per chosen
 * ration month, showing the date the customer collected in that month.
 */
export function MonthlyDatesTab({
  customers, transactions, monthOptions,
}: {
  /** The dealer's active customers. */
  customers: Customer[];
  transactions: Transaction[];
  monthOptions: { value: string; label: string }[];
}) {
  const { t } = useTranslation();
  const [pivotScheme, setPivotScheme] = useState<"ALL" | "PHH" | "AAY">("ALL");
  const [pivotMonths, setPivotMonths] = useState<string[]>(["", "", ""]);
  const [pivotSort, setPivotSort] = useState<"asc" | "desc" | null>(null);

  const effectivePivotMonths = useMemo(() => {
    const filled = pivotMonths.filter(Boolean);
    if (filled.length > 0) return pivotMonths;
    return monthOptions.slice(0, 3).map((m) => m.value);
  }, [pivotMonths, monthOptions]);

  const pivotDatesByCustomer = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    transactions.forEach((tx) => {
      if (pivotScheme !== "ALL" && tx.scheme !== pivotScheme) return;
      const day = dateOnly(tx.date);
      const ym = rationMonth(tx);
      if (!map[tx.srcNo]) map[tx.srcNo] = {};
      map[tx.srcNo][ym] = day;
    });
    return map;
  }, [transactions, pivotScheme]);

  const pivotRows = useMemo(() => {
    const rows = customers
      .filter((c) => pivotScheme === "ALL" || c.scheme === pivotScheme)
      .map((c) => ({
        srcNo: c.srcNo,
        name: c.name,
        mobile: c.mobile,
        memberCount: c.memberCount,
        dates: effectivePivotMonths.map((ym) => (ym ? pivotDatesByCustomer[c.srcNo]?.[ym] || "" : "")),
      }));
    if (pivotSort) {
      rows.sort((a, b) =>
        pivotSort === "asc" ? a.srcNo.localeCompare(b.srcNo) : b.srcNo.localeCompare(a.srcNo)
      );
    }
    return rows;
  }, [customers, pivotScheme, pivotDatesByCustomer, effectivePivotMonths, pivotSort]);

  return (
    <div className="card p-6">
      <div className="no-print flex flex-wrap items-center gap-3 mb-4">
        <select
          value={pivotScheme}
          onChange={(e) => setPivotScheme(e.target.value as "ALL" | "PHH" | "AAY")}
          className="input-field w-36 text-xs"
        >
          <option value="ALL">{t("reports.schemeAll")}</option>
          <option value="PHH">PHH</option>
          <option value="AAY">AAY</option>
        </select>

        {[0, 1, 2].map((idx) => (
          <select
            key={idx}
            value={effectivePivotMonths[idx] || ""}
            onChange={(e) => {
              const next = [...effectivePivotMonths];
              next[idx] = e.target.value;
              setPivotMonths(next);
            }}
            className="input-field w-36 text-xs"
            aria-label={`${t("reports.selectMonth")} ${idx + 1}`}
          >
            <option value="">{t("reports.selectMonth")} {idx + 1}</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        ))}

        <button onClick={() => window.print()} className="btn-secondary text-xs">
          🖨️ {t("reports.printReport")}
        </button>
      </div>

      <h3 className="text-base font-bold text-center text-brand-700 mb-5">
        {t("reports.monthlyDates")} — {pivotScheme === "ALL" ? t("reports.schemeAll") : pivotScheme}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm monthly-dates-table">
          <thead>
            <tr className="table-head">
              <th className="px-2 py-1.5 text-left font-semibold">{t("reports.srNo")}</th>
              <th
                className="px-2 py-1.5 text-left font-semibold cursor-pointer select-none"
                onClick={() =>
                  setPivotSort((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"))
                }
              >
                {t("reports.customerId")}
                <span className="ml-1 text-xs">
                  {pivotSort === "asc" ? "▲" : pivotSort === "desc" ? "▼" : "⇅"}
                </span>
              </th>
              <th className="px-2 py-1.5 text-left font-semibold">{t("reports.customerName")}</th>
              <th className="px-2 py-1.5 text-left font-semibold">{t("customers.mobile")}</th>
              <th className="px-2 py-1.5 text-right font-semibold">{t("reports.units")}</th>
              {effectivePivotMonths.map((ym, idx) => (
                <th key={idx} className="px-2 py-1.5 text-right font-semibold">
                  {ym ? getMonthName(parseInt(ym.split("-")[1], 10)) : "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivotRows.map((row, i) => (
              <tr key={row.srcNo} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="px-2 py-1 font-mono">{i + 1}</td>
                <td className="px-2 py-1 font-mono">{row.srcNo}</td>
                <td className="px-2 py-1">{row.name}</td>
                <td className="px-2 py-1 font-mono text-gray-500">{row.mobile || "—"}</td>
                <td className="px-2 py-1 text-right font-mono">{row.memberCount ?? "—"}</td>
                {row.dates.map((d, idx) => (
                  <td key={idx} className="px-2 py-1 text-right font-mono">
                    {d ? formatDate(d) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

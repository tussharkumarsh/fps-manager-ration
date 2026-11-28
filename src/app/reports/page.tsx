"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, TabGroup, EmptyState, ColumnPicker, type Column } from "@/components/ui";
import { calculateDailySummary, getMonthName, formatNumber, formatDate, dateOnly, getDistinctMonths, getCurrentMonth, activeCustomers, rationMonth } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { apiFetch } from "@/lib/apiFetch";
import type { DailySummary, Transaction } from "@/types";
import { myCustomers } from "@/lib/familySummary";
import { MultiTransactionReport } from "@/components/reports/MultiTransactionReport";
import { PendingListTab } from "@/components/reports/PendingListTab";
import { GoshwaraTab } from "@/components/reports/GoshwaraTab";
import { MonthlyDatesTab } from "@/components/reports/MonthlyDatesTab";

const DAILY_COLUMNS_STORAGE_KEY = "reports.dailyColumns.v2";
/** Saved before the Families column existed; read once and carried over with it switched on. */
const DAILY_COLUMNS_STORAGE_KEY_V1 = "reports.dailyColumns";

export default function ReportsPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { transactions, customers: allCustomers, settings, viewingDealer } = useStore();
  const isAdmin = session?.role === "admin";
  const readOnly = isAdmin;
  const aggregateMode = isAdmin && !viewingDealer;
  // Active master cards with at least one transaction (in any month): cards
  // that never took ration stay out of the pending list and every report.
  const customers = useMemo(
    () =>
      activeCustomers(
        aggregateMode
          ? allCustomers
          : myCustomers(allCustomers, transactions, viewingDealer?.fpsId ?? settings.fpsId)
      ),
    [aggregateMode, allCustomers, transactions, viewingDealer?.fpsId, settings.fpsId]
  );
  const scopeLabel = aggregateMode
    ? t("common.allDealersCollective")
    : `FPS ${viewingDealer?.fpsId ?? settings.fpsId}`;
  useAutoLoadMonth(settings.month, settings.year);
  const [reportType, setReportType] = useState("daily");
  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonth());
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [printScheme, setPrintScheme] = useState<"ALL" | "PHH" | "AAY">("ALL");
  // Deep link from the dashboard: /reports?tab=multiTxn&month=YYYY-MM (or ALL).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tab = q.get("tab");
    const month = q.get("month");
    if (tab === "multiTxn") setReportType(tab);
    if (month && (month === "ALL" || /^\d{4}-\d{2}$/.test(month))) setMonthFilter(month);
  }, []);

  // null = all daily-summary columns (the default before any choice is made).
  const [dailyColumnKeys, setDailyColumnKeys] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DAILY_COLUMNS_STORAGE_KEY);
      if (stored) {
        setDailyColumnKeys(JSON.parse(stored));
      } else {
        const old = localStorage.getItem(DAILY_COLUMNS_STORAGE_KEY_V1);
        if (old) setDailyColumnKeys([...JSON.parse(old), "totalFamilies"]);
      }
    } catch {
      // Storage unavailable or corrupt — fall back to all columns.
    }
  }, []);

  const changeDailyColumns = (keys: string[]) => {
    setDailyColumnKeys(keys);
    try {
      localStorage.setItem(DAILY_COLUMNS_STORAGE_KEY, JSON.stringify(keys));
    } catch {
      // Non-fatal — the choice just won't be remembered.
    }
  };

  const monthOptions = useMemo(() => getDistinctMonths(transactions), [transactions]);

  const scopedTransactions = useMemo(() => {
    let result = transactions;
    if (monthFilter !== "ALL") result = result.filter((t) => rationMonth(t) === monthFilter);
    if (fromDate) result = result.filter((t) => dateOnly(t.date) >= fromDate);
    if (toDate) result = result.filter((t) => dateOnly(t.date) <= toDate);
    return result;
  }, [transactions, monthFilter, fromDate, toDate]);

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    allCustomers.forEach((c) => { m[c.srcNo] = c.name; });
    return m;
  }, [allCustomers]);

  const enriched = useMemo(
    () => scopedTransactions.map((t) => ({ ...t, customerName: customerMap[t.srcNo] || "" })),
    [scopedTransactions, customerMap]
  );

  const dailySummary = useMemo(() => calculateDailySummary(scopedTransactions), [scopedTransactions]);

  const dailyWithTotals = useMemo(() => {
    const totals: DailySummary = {
      date: "TOTAL",
      phhFamilies: dailySummary.reduce((s, r) => s + r.phhFamilies, 0),
      phhWheat: dailySummary.reduce((s, r) => s + r.phhWheat, 0),
      phhRice: dailySummary.reduce((s, r) => s + r.phhRice, 0),
      phhSugar: dailySummary.reduce((s, r) => s + r.phhSugar, 0),
      phhJowar: dailySummary.reduce((s, r) => s + r.phhJowar, 0),
      aayFamilies: dailySummary.reduce((s, r) => s + r.aayFamilies, 0),
      aayWheat: dailySummary.reduce((s, r) => s + r.aayWheat, 0),
      aayRice: dailySummary.reduce((s, r) => s + r.aayRice, 0),
      aaySugar: dailySummary.reduce((s, r) => s + r.aaySugar, 0),
      aaySaree: dailySummary.reduce((s, r) => s + r.aaySaree, 0),
      aayJowar: dailySummary.reduce((s, r) => s + r.aayJowar, 0),
      totalWheat: dailySummary.reduce((s, r) => s + r.totalWheat, 0),
      totalRice: dailySummary.reduce((s, r) => s + r.totalRice, 0),
      totalSugar: dailySummary.reduce((s, r) => s + r.totalSugar, 0),
      totalJowar: dailySummary.reduce((s, r) => s + r.totalJowar, 0),
      totalTransactions: dailySummary.reduce((s, r) => s + r.totalTransactions, 0),
      // Distinct over the whole period: a family served on two days counts once.
      totalFamilies: new Set(scopedTransactions.map((t) => t.srcNo)).size,
    };
    return [...dailySummary, totals];
  }, [dailySummary, scopedTransactions]);

  const monthLabel =
    monthFilter !== "ALL"
      ? monthOptions.find((m) => m.value === monthFilter)?.label || monthFilter
      : `${getMonthName(parseInt(settings.month))} ${settings.year}`;

  /** Render the print-only tables for the chosen scheme(s), then open the print dialog. */
  const printSchemeReport = (scheme: "ALL" | "PHH" | "AAY") => {
    setPrintScheme(scheme);
    setTimeout(() => {
      window.print();
      setPrintScheme("ALL");
    }, 0);
  };

  const dailyColumns: Column<DailySummary>[] = [
    { key: "date", label: t("transactions.date"), mono: true,
      render: (v) =>
        String(v) === "TOTAL"
          ? <span className="font-bold text-blue-700">{t("reports.total")}</span>
          : <span>{formatDate(String(v))}</span> },
    { key: "phhFamilies", label: "PHH #", align: "right", mono: true },
    { key: "phhWheat", label: "PHH Wheat", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "phhRice", label: "PHH Rice", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "phhSugar", label: "PHH Sugar", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "phhJowar", label: "PHH Jowar", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "aayFamilies", label: "AAY #", align: "right", mono: true },
    { key: "aayWheat", label: "AAY Wheat", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "aayRice", label: "AAY Rice", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "aaySugar", label: "AAY Sugar", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "aaySaree", label: t("transactions.saree"), align: "right", mono: true },
    { key: "aayJowar", label: "AAY Jowar", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
    { key: "totalWheat", label: `${t("reports.total")} ${t("transactions.wheat")}`, align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
    { key: "totalRice", label: `${t("reports.total")} ${t("transactions.rice")}`, align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
    { key: "totalSugar", label: `${t("reports.total")} ${t("transactions.sugar")}`, align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
    { key: "totalJowar", label: `${t("reports.total")} ${t("transactions.jowar")}`, align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
    { key: "totalTransactions", label: "Total Txns", align: "right", mono: true },
    { key: "totalFamilies", label: t("reports.familiesServed"), align: "right", mono: true,
      render: (v) => <strong className="text-emerald-700">{formatNumber(Number(v))}</strong> },
  ];

  // Which daily-summary columns to show and print. Date is always kept; the
  // choice is remembered per browser.
  const visibleDailyColumns = dailyColumns.filter(
    (c) => c.key === "date" || dailyColumnKeys === null || dailyColumnKeys.includes(String(c.key))
  );

  const hasActiveFilter = monthFilter !== "ALL" || !!fromDate || !!toDate;

  if (transactions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">📑 {t("reports.title")}</h1>
        <EmptyState icon="📑" title={t("reports.noDataTitle")} description={t("reports.noDataDesc")} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="no-print flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📑 {t("reports.title")}</h1>
          <p className="text-sm text-gray-500">
            {scopeLabel} · {monthLabel} · {formatNumber(scopedTransactions.length)} record(s)
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          {/* Month filter */}
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">{t("dashboard.allMonths")}</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Date range filter */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="input-field w-36 text-xs" aria-label="From date" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="input-field w-36 text-xs" aria-label="To date" />
          </div>

          {hasActiveFilter && (
            <button
              onClick={() => { setMonthFilter("ALL"); setFromDate(""); setToDate(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {t("common.clearFilters")}
            </button>
          )}
        </div>
      </div>

      <div className="no-print">
        <TabGroup
          tabs={[
            { id: "daily", label: t("reports.dailySummary") },
            { id: "scheme", label: t("reports.schemeWise") },
            { id: "pending", label: t("reports.pendingList") },
            { id: "goshwara", label: t("reports.goshwara") },
            { id: "monthlyDates", label: t("reports.monthlyDates") },
            { id: "multiTxn", label: t("reports.multiTxn") },
          ]}
          active={reportType}
          onChange={setReportType}
        />
      </div>

      {/* Daily Summary */}
      {reportType === "daily" && (
        <>
          <div className="no-print flex justify-end gap-2">
            <ColumnPicker
              label={t("reports.columns")}
              options={dailyColumns.map((c) => ({ key: String(c.key), label: c.label, locked: c.key === "date" }))}
              selected={visibleDailyColumns.map((c) => String(c.key))}
              onChange={changeDailyColumns}
              selectAllLabel={t("reports.selectAllColumns")}
              clearLabel={t("reports.clearColumns")}
            />
            <button onClick={() => window.print()} className="btn-secondary text-xs">
              🖨️ {t("reports.printReport")}
            </button>
          </div>
          <div className="no-print">
            <DataTable<DailySummary>
              columns={visibleDailyColumns}
              data={dailyWithTotals}
              pageSize={50}
              searchable={false}
            />
          </div>

          {/* Print-only: full daily summary on a landscape page */}
          <style>{"@media print { @page { size: landscape; } }"}</style>
          <div className="hidden print:block">
            <h3 className="text-base font-bold text-center mb-1">{t("reports.dailySummary")}</h3>
            <p className="text-xs text-center mb-3">
              {scopeLabel} · {monthLabel}
            </p>
            <table className="w-full border-collapse monthly-dates-table">
              <thead>
                <tr>
                  {visibleDailyColumns.map((c) => (
                    <th key={String(c.key)} className={c.align === "right" ? "text-right" : "text-left"}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyWithTotals.map((row) => {
                  const isTotal = row.date === "TOTAL";
                  return (
                    <tr key={row.date} className={isTotal ? "font-bold" : ""}>
                      {visibleDailyColumns.map((c) => (
                        <td key={String(c.key)} className={`font-mono ${c.align === "right" ? "text-right" : ""}`}>
                          {c.key === "date"
                            ? isTotal ? t("reports.total") : formatDate(row.date)
                            : formatNumber(Number(row[c.key as keyof DailySummary]))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Scheme-wise */}
      {reportType === "scheme" && (
        <>
        <div className="no-print flex justify-end">
          <button onClick={() => printSchemeReport("ALL")} className="btn-secondary text-xs">
            🖨️ {t("reports.printReport")} (PHH + AAY)
          </button>
        </div>
        <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-blue-800">PHH — {t("dashboard.priorityHousehold")}</h3>
              <button onClick={() => printSchemeReport("PHH")} className="btn-secondary text-xs">
                🖨️ {t("reports.printReport")}
              </button>
            </div>
            <DataTable<Transaction & { customerName?: string }>
              columns={[
                { key: "date", label: t("transactions.date"), mono: true, render: (v) => formatDate(dateOnly(String(v))) },
                { key: "srcNo", label: t("transactions.srcNo"), mono: true },
                { key: "customerName", label: t("transactions.customerName"), render: (v) => String(v) || "—" },
                { key: "availType", label: t("transactions.authType"), render: (v) => <Badge text={String(v)} /> },
                { key: "wheat", label: t("transactions.wheat"), align: "right", mono: true },
                { key: "rice", label: t("transactions.rice"), align: "right", mono: true },
                { key: "sugar", label: t("transactions.sugar"), align: "right", mono: true },
                { key: "jowar", label: t("transactions.jowar"), align: "right", mono: true },
              ]}
              data={enriched.filter((t) => t.scheme === "PHH")}
              maxHeight={450}
            />
          </div>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-amber-800">AAY — {t("dashboard.antyodaya")}</h3>
              <button onClick={() => printSchemeReport("AAY")} className="btn-secondary text-xs">
                🖨️ {t("reports.printReport")}
              </button>
            </div>
            <DataTable<Transaction & { customerName?: string }>
              columns={[
                { key: "date", label: t("transactions.date"), mono: true, render: (v) => formatDate(dateOnly(String(v))) },
                { key: "srcNo", label: t("transactions.srcNo"), mono: true },
                { key: "customerName", label: t("transactions.customerName"), render: (v) => String(v) || "—" },
                { key: "availType", label: t("transactions.authType"), render: (v) => <Badge text={String(v)} /> },
                { key: "wheat", label: t("transactions.wheat"), align: "right", mono: true },
                { key: "rice", label: t("transactions.rice"), align: "right", mono: true },
                { key: "sugar", label: t("transactions.sugar"), align: "right", mono: true },
                { key: "saree", label: t("transactions.saree"), align: "right", mono: true },
                { key: "jowar", label: t("transactions.jowar"), align: "right", mono: true },
              ]}
              data={enriched.filter((t) => t.scheme === "AAY")}
              maxHeight={450}
            />
          </div>
        </div>

        {/* Print-only: full, unpaginated record lists for both schemes */}
        <div className="hidden print:block space-y-6">
          {(["PHH", "AAY"] as const).filter((scheme) => printScheme === "ALL" || printScheme === scheme).map((scheme) => {
            const rows = enriched
              .filter((tx) => tx.scheme === scheme)
              .sort((a, b) => dateOnly(a.date).localeCompare(dateOnly(b.date)) || a.srcNo.localeCompare(b.srcNo));
            const isAay = scheme === "AAY";
            const sum = (k: "wheat" | "rice" | "sugar" | "saree" | "jowar") => rows.reduce((s, r) => s + r[k], 0);
            return (
              <div key={scheme} className={isAay && printScheme === "ALL" ? "break-before-page" : ""}>
                <h3 className="text-base font-bold text-center mb-1">
                  {scheme} — {isAay ? t("dashboard.antyodaya") : t("dashboard.priorityHousehold")}
                </h3>
                <p className="text-xs text-center mb-3">
                  {scopeLabel} · {monthLabel} · {formatNumber(rows.length)} record(s)
                </p>
                <table className="w-full border-collapse monthly-dates-table">
                  <thead>
                    <tr>
                      <th className="text-left">{t("reports.srNo")}</th>
                      <th className="text-left">{t("transactions.date")}</th>
                      <th className="text-left">{t("transactions.srcNo")}</th>
                      <th className="text-left">{t("transactions.customerName")}</th>
                      <th className="text-left">{t("transactions.authType")}</th>
                      <th className="text-right">{t("transactions.wheat")}</th>
                      <th className="text-right">{t("transactions.rice")}</th>
                      <th className="text-right">{t("transactions.sugar")}</th>
                      {isAay && <th className="text-right">{t("transactions.saree")}</th>}
                      <th className="text-right">{t("transactions.jowar")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.srcNo}-${r.date}-${i}`}>
                        <td className="font-mono">{i + 1}</td>
                        <td className="font-mono">{formatDate(dateOnly(r.date))}</td>
                        <td className="font-mono">{r.srcNo}</td>
                        <td>{r.customerName || "—"}</td>
                        <td>{r.availType}</td>
                        <td className="text-right font-mono">{r.wheat}</td>
                        <td className="text-right font-mono">{r.rice}</td>
                        <td className="text-right font-mono">{r.sugar}</td>
                        {isAay && <td className="text-right font-mono">{r.saree}</td>}
                        <td className="text-right font-mono">{r.jowar}</td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td colSpan={5}>{t("reports.total")}</td>
                      <td className="text-right font-mono">{formatNumber(sum("wheat"))}</td>
                      <td className="text-right font-mono">{formatNumber(sum("rice"))}</td>
                      <td className="text-right font-mono">{formatNumber(sum("sugar"))}</td>
                      {isAay && <td className="text-right font-mono">{formatNumber(sum("saree"))}</td>}
                      <td className="text-right font-mono">{formatNumber(sum("jowar"))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
        </>
      )}

      {reportType === "pending" && (
        <PendingListTab
          customers={customers}
          scopedTransactions={scopedTransactions}
          transactions={transactions}
          monthLabel={monthLabel}
          readOnly={readOnly}
        />
      )}

      {reportType === "goshwara" && (
        <GoshwaraTab
          scopedTransactions={scopedTransactions}
          monthFilter={monthFilter}
          monthLabel={monthLabel}
          scopeLabel={scopeLabel}
          readOnly={readOnly}
          aggregateMode={aggregateMode}
          viewFpsId={viewingDealer?.fpsId}
        />
      )}

      {reportType === "multiTxn" && (
        <MultiTransactionReport
          transactions={scopedTransactions}
          customers={allCustomers}
          scopeLabel={scopeLabel}
          periodLabel={monthFilter === "ALL" ? t("dashboard.allMonths") : monthLabel}
        />
      )}

      {reportType === "monthlyDates" && (
        <MonthlyDatesTab customers={customers} transactions={transactions} monthOptions={monthOptions} />
      )}
    </div>
  );
}

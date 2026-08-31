"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, TabGroup, EmptyState } from "@/components/ui";
import { calculateDailySummary, getMonthName, formatNumber, formatDate, dateOnly, getDistinctMonths, activeCustomers } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { apiFetch } from "@/lib/apiFetch";
import type { DailySummary, Transaction, Customer } from "@/types";

/** The most recent transaction month for this customer, e.g. "July 2026" — or "" if none. */
function lastDispatchedMonth(txns: { date: string }[]): string {
  if (txns.length === 0) return "";
  const latest = txns.reduce((max, t) => (dateOnly(t.date) > dateOnly(max.date) ? t : max));
  const [year, month] = dateOnly(latest.date).split("-");
  return `${getMonthName(parseInt(month, 10))} ${year}`;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const { transactions, customers: allCustomers, settings, viewingDealer, updateCustomer } = useStore();
  const customers = useMemo(() => activeCustomers(allCustomers), [allCustomers]);
  const isAdmin = session?.role === "admin";
  const readOnly = isAdmin;
  const aggregateMode = isAdmin && !viewingDealer;
  const scopeLabel = aggregateMode
    ? t("common.allDealersCollective")
    : `FPS ${viewingDealer?.fpsId ?? settings.fpsId}`;
  useAutoLoadMonth(settings.month, settings.year);
  const [reportType, setReportType] = useState("daily");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [pivotScheme, setPivotScheme] = useState<"ALL" | "PHH" | "AAY">("ALL");
  const [pivotMonths, setPivotMonths] = useState<string[]>(["", "", ""]);
  const [disableTarget, setDisableTarget] = useState<Customer | null>(null);
  const [disableReason, setDisableReason] = useState("");

  const patchCustomer = async (srcNo: string, patch: Partial<Customer>) => {
    try {
      const res = await apiFetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srcNo, ...patch }),
      });
      if (!res.ok) return;
      updateCustomer(srcNo, patch);
    } catch {
      // Non-fatal — local state stays unchanged, matching what's actually stored.
    }
  };

  const monthOptions = useMemo(() => getDistinctMonths(transactions), [transactions]);

  const scopedTransactions = useMemo(() => {
    let result = transactions;
    if (monthFilter !== "ALL") result = result.filter((t) => dateOnly(t.date).slice(0, 7) === monthFilter);
    if (fromDate) result = result.filter((t) => dateOnly(t.date) >= fromDate);
    if (toDate) result = result.filter((t) => dateOnly(t.date) <= toDate);
    return result;
  }, [transactions, monthFilter, fromDate, toDate]);

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => { m[c.srcNo] = c.name; });
    return m;
  }, [customers]);

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
    };
    return [...dailySummary, totals];
  }, [dailySummary]);

  const monthLabel =
    monthFilter !== "ALL"
      ? monthOptions.find((m) => m.value === monthFilter)?.label || monthFilter
      : `${getMonthName(parseInt(settings.month))} ${settings.year}`;

  const pendingCustomers = useMemo(() => {
    const collected = new Set(scopedTransactions.filter((t) => t.wheat > 0).map((t) => t.srcNo));
    return customers
      .filter((c) => !collected.has(c.srcNo))
      .map((c) => {
        const txns = transactions.filter((tr) => tr.srcNo === c.srcNo);
        const lastDispatched = lastDispatchedMonth(txns);
        return { ...c, lastDispatched };
      });
  }, [scopedTransactions, customers, transactions]);

  const goshwaraRows = useMemo(() => {
    const phh = enriched.filter((t) => t.scheme === "PHH");
    const aay = enriched.filter((t) => t.scheme === "AAY");
    return [
      { label: t("reports.familiesServed"), phh: phh.length, aay: aay.filter((t) => t.wheat > 0).length },
      { label: t("reports.wheatDistributed"), phh: phh.reduce((s, t) => s + t.wheat, 0), aay: aay.reduce((s, t) => s + t.wheat, 0) },
      { label: t("reports.riceDistributed"), phh: phh.reduce((s, t) => s + t.rice, 0), aay: aay.reduce((s, t) => s + t.rice, 0) },
      { label: `${t("transactions.saree")} (Pkts)`, phh: 0, aay: aay.reduce((s, t) => s + t.saree, 0) },
      { label: t("reports.portabilityTxns"), phh: phh.filter((t) => t.portability !== "Self").length, aay: aay.filter((t) => t.portability !== "Self").length },
      { label: t("reports.activeDays"), phh: new Set(phh.map((t) => dateOnly(t.date))).size, aay: new Set(aay.map((t) => dateOnly(t.date))).size },
    ];
  }, [enriched, t]);

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
      const ym = day.slice(0, 7);
      if (!map[tx.srcNo]) map[tx.srcNo] = {};
      map[tx.srcNo][ym] = day;
    });
    return map;
  }, [transactions, pivotScheme]);

  const pivotRows = useMemo(() => {
    return customers
      .filter((c) => pivotScheme === "ALL" || c.scheme === pivotScheme)
      .map((c) => ({
        srcNo: c.srcNo,
        name: c.name,
        memberCount: c.memberCount,
        dates: effectivePivotMonths.map((ym) => (ym ? pivotDatesByCustomer[c.srcNo]?.[ym] || "" : "")),
      }));
  }, [customers, pivotScheme, pivotDatesByCustomer, effectivePivotMonths]);

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
          ]}
          active={reportType}
          onChange={setReportType}
        />
      </div>

      {/* Daily Summary */}
      {reportType === "daily" && (
        <DataTable<DailySummary>
          columns={[
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
          ]}
          data={dailyWithTotals}
          pageSize={50}
          searchable={false}
        />
      )}

      {/* Scheme-wise */}
      {reportType === "scheme" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3 text-blue-800">PHH — {t("dashboard.priorityHousehold")}</h3>
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
            <h3 className="text-sm font-semibold mb-3 text-amber-800">AAY — {t("dashboard.antyodaya")}</h3>
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
      )}

      {/* Pending */}
      {reportType === "pending" && (
        <div className="card p-6">
          <div className="no-print flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="bg-red-50 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-red-700">
                {pendingCustomers.length} customers have not collected ration for {monthLabel}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-secondary text-xs">
              🖨️ {t("reports.printReport")}
            </button>
          </div>

          <h3 className="text-base font-bold text-center text-brand-700 mb-5">
            {t("reports.pendingList")} — {monthLabel}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white">
                  <th className="px-4 py-3 text-left font-semibold">{t("reports.srNo")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("transactions.srcNo")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("transactions.customerName")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("customers.mobile")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("customers.lastDispatched")}</th>
                  {!readOnly && (
                    <th className="no-print px-4 py-3 text-center font-semibold">{t("common.actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pendingCustomers.map((c, i) => (
                  <tr key={c.srcNo} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="px-4 py-3 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 font-mono">{c.srcNo}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{c.mobile || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.lastDispatched || "—"}</td>
                    {!readOnly && (
                      <td className="no-print px-4 py-3 text-center">
                        {c.disabled ? (
                          <button
                            onClick={() => patchCustomer(c.srcNo, { disabled: false, disabledReason: "", disabledAt: "" })}
                            className="text-emerald-600 hover:text-emerald-800 text-xs font-medium"
                          >
                            {t("customers.enable")}
                          </button>
                        ) : (
                          <button
                            onClick={() => { setDisableTarget(c); setDisableReason(""); }}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                          >
                            {t("customers.disable")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {pendingCustomers.length === 0 && (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="px-4 py-12 text-center text-gray-400">
                      {t("customers.noRecordsFound")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {disableTarget && (
            <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={() => setDisableTarget(null)}>
              <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold mb-1">{t("customers.disableCustomer")}</h3>
                <p className="text-xs text-gray-500 mb-3">
                  {disableTarget.name} ({disableTarget.srcNo})
                </p>
                <label className="text-xs font-medium text-gray-500 block mb-1">{t("customers.disableReasonLabel")}</label>
                <textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  placeholder={t("customers.disableReasonPlaceholder")}
                  className="input-field w-full mb-4"
                  rows={3}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDisableTarget(null)} className="btn-secondary text-xs">
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={async () => {
                      if (!disableTarget || !disableReason.trim()) return;
                      await patchCustomer(disableTarget.srcNo, {
                        disabled: true,
                        disabledReason: disableReason.trim(),
                        disabledAt: new Date().toISOString(),
                      });
                      setDisableTarget(null);
                      setDisableReason("");
                    }}
                    disabled={!disableReason.trim()}
                    className="btn-primary text-xs disabled:opacity-40"
                  >
                    {t("customers.disable")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Goshwara */}
      {reportType === "goshwara" && (
        <div className="card p-6 max-w-3xl">
          <h3 className="text-base font-bold text-center text-brand-700 mb-5">
            गोषवारा — {t("reports.monthlySummary")} ({monthLabel})
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-700 text-white">
                <th className="px-4 py-3 text-left font-semibold">{t("reports.particulars")}</th>
                <th className="px-4 py-3 text-right font-semibold">PHH</th>
                <th className="px-4 py-3 text-right font-semibold">AAY</th>
                <th className="px-4 py-3 text-right font-semibold">{t("reports.total")}</th>
              </tr>
            </thead>
            <tbody>
              {goshwaraRows.map((row, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(row.phh)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatNumber(row.aay)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatNumber(row.phh + row.aay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <button onClick={() => window.print()} className="btn-secondary text-xs">
              🖨️ {t("reports.printReport")}
            </button>
          </div>
        </div>
      )}

      {/* Monthly Dates (Customer x Month pivot) */}
      {reportType === "monthlyDates" && (
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
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white">
                  <th className="px-4 py-3 text-left font-semibold">{t("reports.customerId")}</th>
                  <th className="px-4 py-3 text-left font-semibold">{t("reports.customerName")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("reports.units")}</th>
                  {effectivePivotMonths.map((ym, idx) => (
                    <th key={idx} className="px-4 py-3 text-right font-semibold">
                      {ym ? monthOptions.find((m) => m.value === ym)?.label || ym : "—"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivotRows.map((row, i) => (
                  <tr key={row.srcNo} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="px-4 py-3 font-mono">{row.srcNo}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.memberCount ?? "—"}</td>
                    {row.dates.map((d, idx) => (
                      <td key={idx} className="px-4 py-3 text-right font-mono">
                        {d ? formatDate(d) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

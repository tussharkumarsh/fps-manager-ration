"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, TabGroup, EmptyState } from "@/components/ui";
import { calculateDailySummary, getMonthName, formatNumber, formatDate, dateOnly, getDistinctMonths } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import type { DailySummary, Transaction, Customer } from "@/types";

export default function ReportsPage() {
  const { data: session } = useSession();
  const { transactions, customers, settings, viewingDealer } = useStore();
  const aggregateMode = session?.role === "admin" && !viewingDealer;
  const scopeLabel = aggregateMode
    ? "All Dealers (Collective)"
    : `FPS ${viewingDealer?.fpsId ?? settings.fpsId}`;
  useAutoLoadMonth(settings.month, settings.year);
  const [reportType, setReportType] = useState("daily");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

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
      aayFamilies: dailySummary.reduce((s, r) => s + r.aayFamilies, 0),
      aayWheat: dailySummary.reduce((s, r) => s + r.aayWheat, 0),
      aayRice: dailySummary.reduce((s, r) => s + r.aayRice, 0),
      aaySaree: dailySummary.reduce((s, r) => s + r.aaySaree, 0),
      totalWheat: dailySummary.reduce((s, r) => s + r.totalWheat, 0),
      totalRice: dailySummary.reduce((s, r) => s + r.totalRice, 0),
      totalTransactions: dailySummary.reduce((s, r) => s + r.totalTransactions, 0),
    };
    return [...dailySummary, totals];
  }, [dailySummary]);

  const pendingCustomers = useMemo(() => {
    const collected = new Set(scopedTransactions.filter((t) => t.wheat > 0).map((t) => t.srcNo));
    return customers.filter((c) => !collected.has(c.srcNo));
  }, [scopedTransactions, customers]);

  const goshwaraRows = useMemo(() => {
    const phh = enriched.filter((t) => t.scheme === "PHH");
    const aay = enriched.filter((t) => t.scheme === "AAY");
    return [
      { label: "Families Served", phh: phh.length, aay: aay.filter((t) => t.wheat > 0).length },
      { label: "Wheat Distributed (Kg)", phh: phh.reduce((s, t) => s + t.wheat, 0), aay: aay.reduce((s, t) => s + t.wheat, 0) },
      { label: "Rice Distributed (Kg)", phh: phh.reduce((s, t) => s + t.rice, 0), aay: aay.reduce((s, t) => s + t.rice, 0) },
      { label: "Saree (Pkts)", phh: 0, aay: aay.reduce((s, t) => s + t.saree, 0) },
      { label: "Portability Txns", phh: phh.filter((t) => t.portability !== "Self").length, aay: aay.filter((t) => t.portability !== "Self").length },
      { label: "Active Days", phh: new Set(phh.map((t) => dateOnly(t.date))).size, aay: new Set(aay.map((t) => dateOnly(t.date))).size },
    ];
  }, [enriched]);

  const monthLabel =
    monthFilter !== "ALL"
      ? monthOptions.find((m) => m.value === monthFilter)?.label || monthFilter
      : `${getMonthName(parseInt(settings.month))} ${settings.year}`;

  const hasActiveFilter = monthFilter !== "ALL" || !!fromDate || !!toDate;

  if (transactions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">📑 Reports</h1>
        <EmptyState icon="📑" title="No data for reports" description="Fetch transactions first to generate reports." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📑 Reports</h1>
          <p className="text-sm text-gray-500">
            {scopeLabel} · {monthLabel} · {formatNumber(scopedTransactions.length)} record(s)
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          {/* Month filter */}
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">All Months</option>
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
              Clear filters
            </button>
          )}
        </div>
      </div>

      <TabGroup
        tabs={[
          { id: "daily", label: "Daily Summary" },
          { id: "scheme", label: "Scheme-wise" },
          { id: "pending", label: "Pending List" },
          { id: "goshwara", label: "Goshwara" },
        ]}
        active={reportType}
        onChange={setReportType}
      />

      {/* Daily Summary */}
      {reportType === "daily" && (
        <DataTable<DailySummary>
          columns={[
            { key: "date", label: "Date", mono: true,
              render: (v) =>
                String(v) === "TOTAL"
                  ? <span className="font-bold text-blue-700">TOTAL</span>
                  : <span>{formatDate(String(v))}</span> },
            { key: "phhFamilies", label: "PHH #", align: "right", mono: true },
            { key: "phhWheat", label: "PHH Wheat", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
            { key: "phhRice", label: "PHH Rice", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
            { key: "aayFamilies", label: "AAY #", align: "right", mono: true },
            { key: "aayWheat", label: "AAY Wheat", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
            { key: "aayRice", label: "AAY Rice", align: "right", mono: true, render: (v) => formatNumber(Number(v)) },
            { key: "aaySaree", label: "Saree", align: "right", mono: true },
            { key: "totalWheat", label: "Total Wheat", align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
            { key: "totalRice", label: "Total Rice", align: "right", mono: true, render: (v) => <strong>{formatNumber(Number(v))}</strong> },
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
            <h3 className="text-sm font-semibold mb-3 text-blue-800">PHH — Priority Household</h3>
            <DataTable<Transaction & { customerName?: string }>
              columns={[
                { key: "date", label: "Date", mono: true, render: (v) => formatDate(dateOnly(String(v))) },
                { key: "srcNo", label: "SRC No", mono: true },
                { key: "customerName", label: "Name", render: (v) => String(v) || "—" },
                { key: "availType", label: "Auth", render: (v) => <Badge text={String(v)} /> },
                { key: "wheat", label: "Wheat", align: "right", mono: true },
                { key: "rice", label: "Rice", align: "right", mono: true },
              ]}
              data={enriched.filter((t) => t.scheme === "PHH")}
              maxHeight={450}
            />
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3 text-amber-800">AAY — Antyodaya Anna Yojana</h3>
            <DataTable<Transaction & { customerName?: string }>
              columns={[
                { key: "date", label: "Date", mono: true, render: (v) => formatDate(dateOnly(String(v))) },
                { key: "srcNo", label: "SRC No", mono: true },
                { key: "customerName", label: "Name", render: (v) => String(v) || "—" },
                { key: "availType", label: "Auth", render: (v) => <Badge text={String(v)} /> },
                { key: "wheat", label: "Wheat", align: "right", mono: true },
                { key: "rice", label: "Rice", align: "right", mono: true },
                { key: "saree", label: "Saree", align: "right", mono: true },
              ]}
              data={enriched.filter((t) => t.scheme === "AAY")}
              maxHeight={450}
            />
          </div>
        </div>
      )}

      {/* Pending */}
      {reportType === "pending" && (
        <div>
          <div className="bg-red-50 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-red-700">
              {pendingCustomers.length} customers have not collected ration for {monthLabel}
            </p>
          </div>
          <DataTable<Customer>
            columns={[
              { key: "srcNo", label: "SRC No", mono: true },
              { key: "name", label: "Customer Name" },
              { key: "lastDispatched", label: "Last Dispatched",
                render: (v) => <span className="text-gray-500">{String(v) || "—"}</span> },
            ]}
            data={pendingCustomers}
          />
        </div>
      )}

      {/* Goshwara */}
      {reportType === "goshwara" && (
        <div className="card p-6 max-w-3xl">
          <h3 className="text-base font-bold text-center text-brand-700 mb-5">
            गोषवारा — Monthly Summary ({monthLabel})
          </h3>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-700 text-white">
                <th className="px-4 py-3 text-left font-semibold">Particulars</th>
                <th className="px-4 py-3 text-right font-semibold">PHH</th>
                <th className="px-4 py-3 text-right font-semibold">AAY</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
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
              🖨️ Print Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

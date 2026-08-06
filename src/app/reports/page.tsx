"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, TabGroup, EmptyState } from "@/components/ui";
import { calculateDailySummary, getMonthName, formatNumber } from "@/lib/utils";
import type { DailySummary, Transaction, Customer } from "@/types";

export default function ReportsPage() {
  const { transactions, customers, settings } = useStore();
  const [reportType, setReportType] = useState("daily");

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => { m[c.srcNo] = c.name; });
    return m;
  }, [customers]);

  const enriched = useMemo(
    () => transactions.map((t) => ({ ...t, customerName: customerMap[t.srcNo] || "" })),
    [transactions, customerMap]
  );

  const dailySummary = useMemo(() => calculateDailySummary(transactions), [transactions]);

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
    const collected = new Set(transactions.filter((t) => t.wheat > 0).map((t) => t.srcNo));
    return customers.filter((c) => !collected.has(c.srcNo));
  }, [transactions, customers]);

  const goshwaraRows = useMemo(() => {
    const phh = enriched.filter((t) => t.scheme === "PHH");
    const aay = enriched.filter((t) => t.scheme === "AAY");
    return [
      { label: "Families Served", phh: phh.length, aay: aay.filter((t) => t.wheat > 0).length },
      { label: "Wheat Distributed (Kg)", phh: phh.reduce((s, t) => s + t.wheat, 0), aay: aay.reduce((s, t) => s + t.wheat, 0) },
      { label: "Rice Distributed (Kg)", phh: phh.reduce((s, t) => s + t.rice, 0), aay: aay.reduce((s, t) => s + t.rice, 0) },
      { label: "Saree (Pkts)", phh: 0, aay: aay.reduce((s, t) => s + t.saree, 0) },
      { label: "Portability Txns", phh: phh.filter((t) => t.portability !== "Self").length, aay: aay.filter((t) => t.portability !== "Self").length },
      { label: "Active Days", phh: new Set(phh.map((t) => t.date.split(" ")[0])).size, aay: new Set(aay.map((t) => t.date.split(" ")[0])).size },
    ];
  }, [enriched]);

  const monthLabel = `${getMonthName(parseInt(settings.month))} ${settings.year}`;

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
      <h1 className="text-xl font-bold">📑 Reports</h1>
      <p className="text-sm text-gray-500">FPS {settings.fpsId} · {monthLabel}</p>

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
              render: (v) => <span className={String(v) === "TOTAL" ? "font-bold text-blue-700" : ""}>{String(v)}</span> },
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
                { key: "date", label: "Date", mono: true },
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
                { key: "date", label: "Date", mono: true },
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

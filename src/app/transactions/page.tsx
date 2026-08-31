"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, EmptyState } from "@/components/ui";
import { getMonthName, formatNumber, formatDate, dateOnly, getDistinctMonths } from "@/lib/utils";
import { exportRowsToPdf } from "@/lib/pdfExport";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Transaction } from "@/types";

type TransactionRow = Transaction & { customerName?: string; dealerName?: string };

export default function TransactionsPage() {
  const { data: session } = useSession();
  const { transactions, customers, settings, viewingDealer } = useStore();
  const { t } = useTranslation();
  const showDealerColumn = session?.role === "admin" && !viewingDealer;
  useAutoLoadMonth(settings.month, settings.year);
  const [schemeFilter, setSchemeFilter] = useState<"ALL" | "PHH" | "AAY">("ALL");
  const [authFilter, setAuthFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => { m[c.srcNo] = c.name; });
    return m;
  }, [customers]);

  const enriched = useMemo(
    () =>
      transactions.map((t) => ({
        ...t,
        customerName: customerMap[t.srcNo] || t.customerName || "",
      })),
    [transactions, customerMap]
  );

  const monthOptions = useMemo(() => getDistinctMonths(transactions), [transactions]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (schemeFilter !== "ALL") result = result.filter((t) => t.scheme === schemeFilter);
    if (authFilter !== "ALL") result = result.filter((t) => t.availType === authFilter);
    if (monthFilter !== "ALL") result = result.filter((t) => dateOnly(t.date).slice(0, 7) === monthFilter);
    if (fromDate) result = result.filter((t) => dateOnly(t.date) >= fromDate);
    if (toDate) result = result.filter((t) => dateOnly(t.date) <= toDate);
    return result;
  }, [enriched, schemeFilter, authFilter, monthFilter, fromDate, toDate]);

  const totals = useMemo(() => ({
    wheat: filtered.reduce((s, t) => s + t.wheat, 0),
    rice: filtered.reduce((s, t) => s + t.rice, 0),
    sugar: filtered.reduce((s, t) => s + t.sugar, 0),
    saree: filtered.reduce((s, t) => s + t.saree, 0),
    jowar: filtered.reduce((s, t) => s + t.jowar, 0),
  }), [filtered]);

  const handleExportPdf = () => {
    exportRowsToPdf(
      "FPS Transactions Report",
      `FPS ${settings.fpsId} · ${formatNumber(filtered.length)} record(s)` +
        (monthFilter !== "ALL" ? ` · ${monthOptions.find((m) => m.value === monthFilter)?.label}` : "") +
        (fromDate || toDate ? ` · ${fromDate || "…"} to ${toDate || "…"}` : ""),
      [
        { header: "#", key: "slNo" },
        { header: "SRC No", key: "srcNo" },
        { header: "Customer Name", key: "customerName" },
        { header: "Scheme", key: "scheme" },
        { header: "Auth Type", key: "availType" },
        { header: "Date", key: "date" },
        { header: "Wheat (Kg)", key: "wheat" },
        { header: "Rice (Kg)", key: "rice" },
        { header: "Sugar (Kg)", key: "sugar" },
        { header: "Saree", key: "saree" },
        { header: "Jowar (Kg)", key: "jowar" },
        { header: "Amount", key: "amount" },
        { header: "Portability", key: "portability" },
      ],
      filtered.map((t) => ({
        slNo: t.slNo,
        srcNo: t.srcNo,
        customerName: t.customerName || "",
        scheme: t.scheme,
        availType: t.availType,
        date: formatDate(dateOnly(t.date)),
        wheat: t.wheat,
        rice: t.rice,
        sugar: t.sugar,
        saree: t.saree,
        jowar: t.jowar,
        amount: t.amount,
        portability: t.portability,
      })),
      `transactions-${settings.fpsId}-${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  if (transactions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">📋 {t("transactions.title")}</h1>
        <EmptyState
          icon="📋"
          title={t("transactions.noDataTitle")}
          description={t("transactions.noDataDesc")}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📋 {t("transactions.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {getMonthName(parseInt(settings.month))} {settings.year} ·{" "}
            {formatNumber(filtered.length)} of {formatNumber(transactions.length)} records
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          {/* Scheme filter */}
          <div className="flex gap-1">
            {(["ALL", "PHH", "AAY"] as const).map((s) => (
              <button key={s} onClick={() => setSchemeFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  schemeFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}>
                {s === "ALL" ? t("common.all") : s}
              </button>
            ))}
          </div>

          {/* Auth filter */}
          <select value={authFilter} onChange={(e) => setAuthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">{t("transactions.allAuthTypes")}</option>
            <option value="Authenticated">Authenticated</option>
            <option value="OTP">OTP</option>
            <option value="IRIS">IRIS</option>
          </select>

          {/* Month filter */}
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">{t("transactions.allMonths")}</option>
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

          {(schemeFilter !== "ALL" || authFilter !== "ALL" || monthFilter !== "ALL" || fromDate || toDate) && (
            <button
              onClick={() => { setSchemeFilter("ALL"); setAuthFilter("ALL"); setMonthFilter("ALL"); setFromDate(""); setToDate(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {t("common.clearFilters")}
            </button>
          )}

          <button onClick={handleExportPdf} disabled={filtered.length === 0} className="btn-secondary text-xs disabled:opacity-50">
            🖨️ {t("common.exportPdf")}
          </button>
        </div>
      </div>

      {/* Totals bar */}
      <div className="flex gap-6 text-xs text-gray-600 bg-gray-100 rounded-lg px-4 py-2.5">
        <span>{t("transactions.wheat")}: <strong className="font-mono text-gray-900">{formatNumber(totals.wheat)} Kg</strong></span>
        <span>{t("transactions.rice")}: <strong className="font-mono text-gray-900">{formatNumber(totals.rice)} Kg</strong></span>
        <span>{t("transactions.sugar")}: <strong className="font-mono text-gray-900">{formatNumber(totals.sugar)} Kg</strong></span>
        <span>{t("transactions.saree")}: <strong className="font-mono text-gray-900">{formatNumber(totals.saree)} Pkts</strong></span>
        <span>{t("transactions.jowar")}: <strong className="font-mono text-gray-900">{formatNumber(totals.jowar)} Kg</strong></span>
      </div>

      <DataTable<TransactionRow>
        columns={[
          ...(showDealerColumn
            ? [{ key: "dealerName" as const, label: t("transactions.dealer"),
                render: (v: unknown) => <span className="text-gray-700">{String(v || "—")}</span> }]
            : []),
          { key: "slNo", label: t("transactions.slNo"), align: "center", width: "50px" },
          { key: "srcNo", label: t("transactions.srcNo"), mono: true },
          { key: "customerName", label: t("transactions.customerName"),
            render: (v) => <span className="text-gray-800">{String(v) || "—"}</span> },
          { key: "scheme", label: t("transactions.scheme"), render: (v) => <Badge text={String(v)} /> },
          { key: "availType", label: t("transactions.authType"), render: (v) => <Badge text={String(v)} /> },
          { key: "date", label: t("transactions.date"), mono: true,
            render: (v) => <span>{formatDate(dateOnly(String(v)))}</span> },
          { key: "wheat", label: `${t("transactions.wheat")} (Kg)`, align: "right", mono: true },
          { key: "rice", label: `${t("transactions.rice")} (Kg)`, align: "right", mono: true },
          { key: "sugar", label: `${t("transactions.sugar")} (Kg)`, align: "right", mono: true },
          { key: "saree", label: t("transactions.saree"), align: "right", mono: true },
          { key: "jowar", label: `${t("transactions.jowar")} (Kg)`, align: "right", mono: true },
          { key: "amount", label: t("transactions.amount"), align: "right", mono: true,
            render: (v) => <span>{Number(v) > 0 ? `₹${v}` : "—"}</span> },
          { key: "portability", label: t("transactions.portability"),
            render: (v) =>
              v === "Self" ? <Badge text="Self" /> : (
                <span className="text-xs font-semibold text-blue-600">{String(v)}</span>
              ),
          },
        ]}
        data={filtered}
        maxHeight={600}
        pageSize={30}
      />
    </div>
  );
}

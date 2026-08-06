"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, EmptyState } from "@/components/ui";
import { getMonthName, formatNumber } from "@/lib/utils";
import type { Transaction } from "@/types";

export default function TransactionsPage() {
  const { transactions, customers, settings } = useStore();
  const [schemeFilter, setSchemeFilter] = useState<"ALL" | "PHH" | "AAY">("ALL");
  const [authFilter, setAuthFilter] = useState<string>("ALL");

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

  const filtered = useMemo(() => {
    let result = enriched;
    if (schemeFilter !== "ALL") result = result.filter((t) => t.scheme === schemeFilter);
    if (authFilter !== "ALL") result = result.filter((t) => t.availType === authFilter);
    return result;
  }, [enriched, schemeFilter, authFilter]);

  const totals = useMemo(() => ({
    wheat: filtered.reduce((s, t) => s + t.wheat, 0),
    rice: filtered.reduce((s, t) => s + t.rice, 0),
    saree: filtered.reduce((s, t) => s + t.saree, 0),
  }), [filtered]);

  if (transactions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">📋 Transactions</h1>
        <EmptyState
          icon="📋"
          title="No transactions loaded"
          description="Fetch data from the ePOS system via the Sync Data page."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">📋 Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {getMonthName(parseInt(settings.month))} {settings.year} ·{" "}
            {formatNumber(filtered.length)} of {formatNumber(transactions.length)} records
          </p>
        </div>

        <div className="flex gap-4 items-center">
          {/* Scheme filter */}
          <div className="flex gap-1">
            {(["ALL", "PHH", "AAY"] as const).map((s) => (
              <button key={s} onClick={() => setSchemeFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  schemeFilter === s
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Auth filter */}
          <select value={authFilter} onChange={(e) => setAuthFilter(e.target.value)}
            className="input-field w-40 text-xs">
            <option value="ALL">All Auth Types</option>
            <option value="Authenticated">Authenticated</option>
            <option value="OTP">OTP</option>
            <option value="IRIS">IRIS</option>
          </select>
        </div>
      </div>

      {/* Totals bar */}
      <div className="flex gap-6 text-xs text-gray-600 bg-gray-100 rounded-lg px-4 py-2.5">
        <span>Wheat: <strong className="font-mono text-gray-900">{formatNumber(totals.wheat)} Kg</strong></span>
        <span>Rice: <strong className="font-mono text-gray-900">{formatNumber(totals.rice)} Kg</strong></span>
        <span>Saree: <strong className="font-mono text-gray-900">{formatNumber(totals.saree)} Pkts</strong></span>
      </div>

      <DataTable<Transaction & { customerName?: string }>
        columns={[
          { key: "slNo", label: "#", align: "center", width: "50px" },
          { key: "srcNo", label: "SRC No", mono: true },
          { key: "customerName", label: "Customer Name",
            render: (v) => <span className="text-gray-800">{String(v) || "—"}</span> },
          { key: "scheme", label: "Scheme", render: (v) => <Badge text={String(v)} /> },
          { key: "availType", label: "Auth Type", render: (v) => <Badge text={String(v)} /> },
          { key: "date", label: "Date & Time", mono: true },
          { key: "wheat", label: "Wheat (Kg)", align: "right", mono: true },
          { key: "rice", label: "Rice (Kg)", align: "right", mono: true },
          { key: "saree", label: "Saree", align: "right", mono: true },
          { key: "amount", label: "Amount", align: "right", mono: true,
            render: (v) => <span>{Number(v) > 0 ? `₹${v}` : "—"}</span> },
          { key: "portability", label: "Portability",
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

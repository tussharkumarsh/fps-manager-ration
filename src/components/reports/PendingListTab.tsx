"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";
import { dateOnly, getMonthName } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Customer, Transaction } from "@/types";

/** The most recent transaction month for this customer, e.g. "July 2026" — or "" if none. */
function lastDispatchedMonth(txns: { date: string }[]): string {
  if (txns.length === 0) return "";
  const latest = txns.reduce((max, t) => (dateOnly(t.date) > dateOnly(max.date) ? t : max));
  const [year, month] = dateOnly(latest.date).split("-");
  return `${getMonthName(parseInt(month, 10))} ${year}`;
}

/**
 * Reports → Pending List: the dealer's active customers who took no wheat in
 * the period, with their last month of collection; a dealer can disable or
 * re-enable a card from here.
 */
export function PendingListTab({
  customers, scopedTransactions, transactions, monthLabel, readOnly,
}: {
  /** The dealer's active customers. */
  customers: Customer[];
  /** Transactions of the selected period. */
  scopedTransactions: Transaction[];
  /** Every loaded transaction (for "last dispatched"). */
  transactions: Transaction[];
  monthLabel: string;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const updateCustomer = useStore((s) => s.updateCustomer);
  const [disableTarget, setDisableTarget] = useState<Customer | null>(null);
  const [disableReason, setDisableReason] = useState("");

  const pendingCustomers = useMemo(() => {
    const collected = new Set(scopedTransactions.filter((t) => t.wheat > 0).map((t) => t.srcNo));
    const bySrcNo = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const list = bySrcNo.get(tx.srcNo);
      if (list) list.push(tx);
      else bySrcNo.set(tx.srcNo, [tx]);
    }
    return customers
      .filter((c) => !collected.has(c.srcNo))
      .map((c) => ({ ...c, lastDispatched: lastDispatchedMonth(bySrcNo.get(c.srcNo) ?? []) }));
  }, [scopedTransactions, customers, transactions]);

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

  return (
    <div className="card p-6">
      <div className="no-print flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="bg-red-50 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-700">
            {t("reports.pendingCount", { count: pendingCustomers.length, month: monthLabel })}
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
            <tr className="table-head">
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
  );
}

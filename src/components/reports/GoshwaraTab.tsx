"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { withView } from "@/lib/viewParam";
import { dateOnly, formatDate, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ManualGoshwara, Transaction } from "@/types";

/**
 * Reports → Goshwara: the month's summary computed from transactions, beside
 * a hand-entered (manual) goshwara stored per FPS per month. Either or both
 * can be printed.
 */
export function GoshwaraTab({
  scopedTransactions, monthFilter, monthLabel, scopeLabel, readOnly, aggregateMode, viewFpsId,
}: {
  scopedTransactions: Transaction[];
  /** "YYYY-MM" or "ALL". */
  monthFilter: string;
  monthLabel: string;
  scopeLabel: string;
  readOnly: boolean;
  aggregateMode: boolean;
  viewFpsId?: string;
}) {
  const { t } = useTranslation();

  const goshwaraRows = useMemo(() => {
    const phh = scopedTransactions.filter((tx) => tx.scheme === "PHH");
    const aay = scopedTransactions.filter((tx) => tx.scheme === "AAY");
    return [
      { key: "families", label: t("reports.familiesServed"), phh: phh.filter((tx) => tx.wheat > 0).length, aay: aay.filter((tx) => tx.wheat > 0).length },
      { key: "wheat", label: t("reports.wheatDistributed"), phh: phh.reduce((s, tx) => s + tx.wheat, 0), aay: aay.reduce((s, tx) => s + tx.wheat, 0) },
      { key: "rice", label: t("reports.riceDistributed"), phh: phh.reduce((s, tx) => s + tx.rice, 0), aay: aay.reduce((s, tx) => s + tx.rice, 0) },
      { key: "sugar", label: `${t("transactions.sugar")} (Kg)`, phh: phh.reduce((s, tx) => s + tx.sugar, 0), aay: aay.reduce((s, tx) => s + tx.sugar, 0) },
      { key: "jowar", label: `${t("transactions.jowar")} (Kg)`, phh: phh.reduce((s, tx) => s + tx.jowar, 0), aay: aay.reduce((s, tx) => s + tx.jowar, 0) },
      { key: "saree", label: `${t("transactions.saree")} (Pkts)`, phh: 0, aay: aay.reduce((s, tx) => s + tx.saree, 0) },
      { key: "portability", label: t("reports.portabilityTxns"), phh: phh.filter((tx) => tx.portability !== "Self").length, aay: aay.filter((tx) => tx.portability !== "Self").length },
      { key: "activeDays", label: t("reports.activeDays"), phh: new Set(phh.map((tx) => dateOnly(tx.date))).size, aay: new Set(aay.map((tx) => dateOnly(tx.date))).size },
    ];
  }, [scopedTransactions, t]);

  // Manual goshwara: hand-entered figures for the selected month, stored per
  // FPS per month and shown beside the one computed from transactions.
  const manualEnabled = monthFilter !== "ALL" && !aggregateMode;
  const [manualValues, setManualValues] = useState<Record<string, { phh: string; aay: string }>>({});
  const [manualUpdatedAt, setManualUpdatedAt] = useState("");
  const [manualStatus, setManualStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [goshwaraPrint, setGoshwaraPrint] = useState<"both" | "system" | "manual">("both");
  const [savedManual, setSavedManual] = useState<ManualGoshwara | null>(null);
  // A month with saved figures opens read-only (like the computed card); the
  // inputs only show for a month with nothing saved yet, or after Edit.
  const [manualEditing, setManualEditing] = useState(true);

  const applyManual = (g: ManualGoshwara | null) => {
    const values: Record<string, { phh: string; aay: string }> = {};
    for (const [key, v] of Object.entries(g?.entries ?? {})) {
      values[key] = { phh: String(v.phh), aay: String(v.aay) };
    }
    setManualValues(values);
    setManualUpdatedAt(g?.updatedAt ?? "");
    setSavedManual(g);
    setManualEditing(!g);
  };

  const cancelManualEdit = () => {
    applyManual(savedManual);
    setManualStatus("idle");
  };

  useEffect(() => {
    if (!manualEnabled) return;
    let cancelled = false;
    const [year, month] = monthFilter.split("-");
    setManualStatus("idle");
    applyManual(null);
    apiFetch(withView(`/api/goshwara?year=${year}&month=${month}`, viewFpsId))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) applyManual(data.goshwara); })
      .catch(() => { /* Non-fatal — the form just starts empty. */ });
    return () => { cancelled = true; };
  }, [manualEnabled, monthFilter, viewFpsId]);

  const manualNum = (key: string, scheme: "phh" | "aay") => Number(manualValues[key]?.[scheme]) || 0;

  const setManualValue = (key: string, scheme: "phh" | "aay", value: string) => {
    setManualStatus("idle");
    setManualValues((prev) => ({
      ...prev,
      [key]: { phh: prev[key]?.phh ?? "", aay: prev[key]?.aay ?? "", [scheme]: value },
    }));
  };

  const saveManual = async () => {
    const [year, month] = monthFilter.split("-");
    const entries = Object.fromEntries(
      goshwaraRows.map((row) => [row.key, { phh: manualNum(row.key, "phh"), aay: manualNum(row.key, "aay") }])
    );
    setManualStatus("saving");
    try {
      const res = await apiFetch("/api/goshwara", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, entries }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      applyManual(data.goshwara);
      setManualStatus("saved");
    } catch {
      setManualStatus("error");
    }
  };

  const printGoshwara = (target: "both" | "system" | "manual") => {
    setGoshwaraPrint(target);
    // Let React apply the print-visibility classes before the dialog opens.
    setTimeout(() => window.print(), 0);
  };

  return (
    <>
    {goshwaraPrint === "both" && <style>{"@media print { @page { size: landscape; } }"}</style>}
    {manualEnabled && (
      <div className="no-print flex justify-end">
        <button onClick={() => printGoshwara("both")} className="btn-secondary text-xs">
          🖨️ {t("reports.printReport")} ({t("reports.systemGoshwara")} + {t("reports.manualGoshwara")})
        </button>
      </div>
    )}
    <div className={`grid gap-6 xl:grid-cols-2 items-start ${goshwaraPrint === "both" ? "print:grid-cols-2" : "print:block"}`}>
    <div className={`card p-6 ${goshwaraPrint === "manual" ? "print:hidden" : ""}`}>
      <h3 className="text-base font-bold text-center text-brand-700 mb-1">
        गोषवारा — {t("reports.monthlySummary")} ({monthLabel})
      </h3>
      <p className="text-xs text-center text-gray-500 mb-5">
        {scopeLabel} · {t("reports.systemGoshwara")}
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="table-head">
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
      <div className="no-print mt-4 flex justify-end">
        <button onClick={() => printGoshwara("system")} className="btn-secondary text-xs">
          🖨️ {t("reports.printReport")}
        </button>
      </div>
    </div>

    {/* Manual goshwara for the same month */}
    <div className={`card p-6 ${goshwaraPrint === "system" ? "print:hidden" : ""} ${manualEnabled ? "" : "no-print"}`}>
      <h3 className="text-base font-bold text-center text-brand-700 mb-1">
        गोषवारा — {t("reports.manualGoshwara")} ({monthLabel})
      </h3>
      <p className="text-xs text-center text-gray-500 mb-5">
        {scopeLabel}
        {manualUpdatedAt && <span className="no-print"> · {t("reports.lastSaved")}: {formatDate(manualUpdatedAt)}</span>}
      </p>
      {!manualEnabled ? (
        <p className="text-sm text-center text-gray-500 py-8">{t("reports.selectMonthForManual")}</p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3 text-left font-semibold">{t("reports.particulars")}</th>
                <th className="px-4 py-3 text-right font-semibold">PHH</th>
                <th className="px-4 py-3 text-right font-semibold">AAY</th>
                <th className="px-4 py-3 text-right font-semibold">{t("reports.total")}</th>
              </tr>
            </thead>
            <tbody>
              {goshwaraRows.map((row, i) => (
                <tr key={row.key} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  {(["phh", "aay"] as const).map((scheme) => (
                    <td key={scheme} className={`px-4 ${!readOnly && manualEditing ? "py-2" : "py-3"} text-right font-mono`}>
                      {readOnly || !manualEditing ? (
                        formatNumber(manualNum(row.key, scheme))
                      ) : (
                        <>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            value={manualValues[row.key]?.[scheme] ?? ""}
                            onChange={(e) => setManualValue(row.key, scheme, e.target.value)}
                            placeholder="0"
                            aria-label={`${row.label} ${scheme.toUpperCase()}`}
                            className="input-field w-24 ml-auto text-right font-mono py-1 print:hidden"
                          />
                          <span className="hidden print:inline">{formatNumber(manualNum(row.key, scheme))}</span>
                        </>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {formatNumber(manualNum(row.key, "phh") + manualNum(row.key, "aay"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="no-print mt-4 flex items-center justify-end gap-3">
            {manualStatus === "saved" && <span className="text-xs text-green-600">✓ {t("reports.manualSaved")}</span>}
            {manualStatus === "error" && <span className="text-xs text-red-600">{t("reports.manualSaveFailed")}</span>}
            {!readOnly && manualEditing && savedManual && (
              <button onClick={cancelManualEdit} disabled={manualStatus === "saving"} className="btn-secondary text-xs">
                {t("common.cancel")}
              </button>
            )}
            {!readOnly && manualEditing && (
              <button onClick={saveManual} disabled={manualStatus === "saving"} className="btn-primary text-xs">
                {manualStatus === "saving" ? t("common.loading") : t("common.save")}
              </button>
            )}
            {!readOnly && !manualEditing && (
              <button onClick={() => { setManualEditing(true); setManualStatus("idle"); }} className="btn-secondary text-xs">
                ✏️ {t("common.edit")}
              </button>
            )}
            <button onClick={() => printGoshwara("manual")} className="btn-secondary text-xs">
              🖨️ {t("reports.printReport")}
            </button>
          </div>
        </>
      )}
    </div>
    </div>
    </>
  );
}

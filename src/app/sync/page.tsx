"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { Badge, DataTable } from "@/components/ui";
import { getMonthName } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { apiFetch } from "@/lib/apiFetch";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SyncLog } from "@/types";

export default function SyncPage() {
  const { settings, updateSettings, addTransactions, addSyncLog, syncLogs, transactions, viewingDealer } =
    useStore();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const readOnly = session?.role === "admin";
  const [status, setStatus] = useState<"idle" | "fetching" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [monthYear, setMonthYear] = useState({ month: settings.month, year: settings.year });
  const autoLoad = useAutoLoadMonth(settings.month, settings.year);

  // The FPS ID / district code used in the actual government API call is
  // always taken from the signed-in user's session on the server — never
  // from anything sent by the browser. Displayed here read-only so it's
  // clear this can't be changed to fetch another dealer's data.
  const distCode = session?.distCode || "—";
  const fpsId = session?.fpsId || "—";

  const handleFetch = async () => {
    if (readOnly) return;
    setStatus("fetching");
    setMessage("");

    try {
      const res = await apiFetch("/api/fetch-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monthYear),
      });

      const data = await res.json();

      if (data.success) {
        addTransactions(data.transactions);
        const added = data.count;
        const storedNote =
          data.source === "sheet_cache"
            ? "Loaded from the stored Excel sheet (already synced — no API call made)."
            : "Fetched from the government API and saved to the Excel sheet on Vercel.";

        setStatus("success");
        setMessage(`${storedNote} ${added} record(s) for this month.`);

        addSyncLog({
          timestamp: new Date().toISOString(),
          month: monthYear.month,
          year: monthYear.year,
          transactionCount: added,
          status: "success",
          message: `Fetched ${added} transactions`,
        });

        // Also update main settings
        updateSettings(monthYear);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to fetch";
      setStatus("error");
      setMessage(errMsg);

      addSyncLog({
        timestamp: new Date().toISOString(),
        month: monthYear.month,
        year: monthYear.year,
        transactionCount: 0,
        status: "error",
        message: errMsg,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">🔄 {t("sync.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("sync.subtitle")}
        </p>
      </div>

      {readOnly && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800 max-w-2xl">
          {viewingDealer
            ? t("sync.readOnlyAdmin", { name: viewingDealer.displayName })
            : t("sync.readOnlyCollective")}
        </div>
      )}

      {/* Fetch Form */}
      <div className="card p-6 max-w-2xl">
        <h3 className="text-base font-semibold mb-4">{t("sync.fetchTransactions")}</h3>

        {/* API Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 font-mono text-xs space-y-1">
          <div className="text-gray-500">POST</div>
          <div className="text-gray-900 font-medium break-all">
            https://epos.mahafood.gov.in/FPS_Trans_Details.jsp
          </div>
          <div className="text-gray-500 mt-2">Payload (fps_id / dist_code are fixed to your login)</div>
          <div className="text-gray-700">
            dist_code={distCode}&amp;fps_id={fpsId}&amp;month={monthYear.month}&amp;year={monthYear.year}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              {t("sync.districtCodeLabel")} <span className="font-normal text-gray-400">{t("sync.fromLogin")}</span>
            </label>
            <input value={distCode} readOnly disabled
              className="input-field bg-gray-100 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">
              {t("sync.fpsIdLabel")} <span className="font-normal text-gray-400">{t("sync.fromLogin")}</span>
            </label>
            <input value={fpsId} readOnly disabled
              className="input-field bg-gray-100 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t("sync.month")}</label>
            <select value={monthYear.month}
              onChange={(e) => setMonthYear((s) => ({ ...s, month: e.target.value }))}
              className="input-field">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {getMonthName(i + 1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t("sync.year")}</label>
            <input value={monthYear.year}
              onChange={(e) => setMonthYear((s) => ({ ...s, year: e.target.value }))}
              className="input-field" />
          </div>
        </div>

        <button onClick={handleFetch} disabled={status === "fetching" || readOnly} className="btn-primary disabled:opacity-50">
          {status === "fetching" ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span> {t("sync.fetching")}
            </span>
          ) : (
            `🔄 ${t("sync.fetchAndParse")}`
          )}
        </button>

        {/* Status message */}
        {message && (
          <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
            status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {status === "success" ? "✅" : "❌"} {message}
          </div>
        )}
      </div>

      {/* Current data info */}
      <div className="card p-5 max-w-2xl">
        <h3 className="text-sm font-semibold mb-2">{t("sync.currentData")}</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div>{t("sync.transactionsLoaded")}: <strong className="font-mono">{transactions.length}</strong></div>
          <div>{t("sync.uniqueDates")}: <strong className="font-mono">{new Set(transactions.map((t) => t.date.split(" ")[0])).size}</strong></div>
          <div className="flex items-center gap-2 pt-1">
            <span>{t("sync.serverStatus")} {getMonthName(Number(settings.month))} {settings.year}:</span>
            {autoLoad.loading && <span className="text-xs text-gray-400">checking sheet…</span>}
            {!autoLoad.loading && autoLoad.source === "sheet_cache" && (
              <Badge text="Loaded from stored sheet" variant="success" />
            )}
            {!autoLoad.loading && autoLoad.source === "gov_api" && autoLoad.lockStatus === "live" && (
              <Badge text="Live (current month, re-synced)" variant="info" />
            )}
            {!autoLoad.loading && autoLoad.source === "gov_api" && autoLoad.lockStatus === "synced_locked" && (
              <Badge text="Fetched & saved to sheet just now" variant="success" />
            )}
            {!autoLoad.loading && autoLoad.error && (
              <Badge text={`Error: ${autoLoad.error}`} variant="error" />
            )}
          </div>
          {transactions.length > 0 && (
            <button onClick={() => {
              if (confirm("Clear all transactions? This cannot be undone.")) {
                useStore.getState().clearTransactions();
              }
            }} className="text-xs text-red-500 hover:text-red-700 font-medium mt-2">
              {t("sync.clearAllTransactions")}
            </button>
          )}
        </div>
      </div>

      {/* Sync Logs */}
      {syncLogs.length > 0 && (
        <div className="card p-5 max-w-2xl">
          <h3 className="text-sm font-semibold mb-3">{t("sync.syncHistory")}</h3>
          <DataTable<SyncLog>
            columns={[
              { key: "timestamp", label: "Time", mono: true,
                render: (v) => new Date(String(v)).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) },
              { key: "month", label: t("sync.month"),
                render: (v, row) => `${getMonthName(Number(v))} ${row.year}` },
              { key: "transactionCount", label: "Records", align: "right", mono: true },
              { key: "status", label: t("customers.status"),
                render: (v) => <Badge text={String(v)} variant={String(v)} /> },
              { key: "message", label: "Details",
                render: (v) => <span className="text-xs text-gray-500">{String(v)}</span> },
            ]}
            data={syncLogs}
            maxHeight={300}
            searchable={false}
          />
        </div>
      )}
    </div>
  );
}

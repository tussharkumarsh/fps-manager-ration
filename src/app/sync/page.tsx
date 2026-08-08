"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { Badge, DataTable } from "@/components/ui";
import { getMonthName } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { apiFetch } from "@/lib/apiFetch";
import type { SyncLog } from "@/types";

export default function SyncPage() {
  const { settings, updateSettings, addTransactions, addSyncLog, syncLogs, transactions } = useStore();
  const [status, setStatus] = useState<"idle" | "fetching" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [fetchSettings, setFetchSettings] = useState({ ...settings });
  const autoLoad = useAutoLoadMonth(settings.month, settings.year);

  const handleFetch = async () => {
    setStatus("fetching");
    setMessage("");

    try {
      const res = await apiFetch("/api/fetch-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fetchSettings),
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
          month: fetchSettings.month,
          year: fetchSettings.year,
          transactionCount: added,
          status: "success",
          message: `Fetched ${added} transactions`,
        });

        // Also update main settings
        updateSettings(fetchSettings);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to fetch";
      setStatus("error");
      setMessage(errMsg);

      addSyncLog({
        timestamp: new Date().toISOString(),
        month: fetchSettings.month,
        year: fetchSettings.year,
        transactionCount: 0,
        status: "error",
        message: errMsg,
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">🔄 Sync Data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fetch transactions from Maharashtra ePOS system
        </p>
      </div>

      {/* Fetch Form */}
      <div className="card p-6 max-w-2xl">
        <h3 className="text-base font-semibold mb-4">Fetch Transactions</h3>

        {/* API Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5 font-mono text-xs space-y-1">
          <div className="text-gray-500">POST</div>
          <div className="text-gray-900 font-medium break-all">
            https://epos.mahafood.gov.in/FPS_Trans_Details.jsp
          </div>
          <div className="text-gray-500 mt-2">Payload</div>
          <div className="text-gray-700">
            dist_code={fetchSettings.distCode}&amp;fps_id={fetchSettings.fpsId}&amp;month={fetchSettings.month}&amp;year={fetchSettings.year}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">District Code</label>
            <input value={fetchSettings.distCode}
              onChange={(e) => setFetchSettings((s) => ({ ...s, distCode: e.target.value }))}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">FPS ID</label>
            <input value={fetchSettings.fpsId}
              onChange={(e) => setFetchSettings((s) => ({ ...s, fpsId: e.target.value }))}
              className="input-field" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Month</label>
            <select value={fetchSettings.month}
              onChange={(e) => setFetchSettings((s) => ({ ...s, month: e.target.value }))}
              className="input-field">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {getMonthName(i + 1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Year</label>
            <input value={fetchSettings.year}
              onChange={(e) => setFetchSettings((s) => ({ ...s, year: e.target.value }))}
              className="input-field" />
          </div>
        </div>

        <button onClick={handleFetch} disabled={status === "fetching"} className="btn-primary">
          {status === "fetching" ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span> Fetching...
            </span>
          ) : (
            "🔄 Fetch & Parse Data"
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
        <h3 className="text-sm font-semibold mb-2">Current Data</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div>Transactions loaded: <strong className="font-mono">{transactions.length}</strong></div>
          <div>Unique dates: <strong className="font-mono">{new Set(transactions.map((t) => t.date.split(" ")[0])).size}</strong></div>
          <div className="flex items-center gap-2 pt-1">
            <span>Server status for {getMonthName(Number(settings.month))} {settings.year}:</span>
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
              Clear All Transactions
            </button>
          )}
        </div>
      </div>

      {/* Sync Logs */}
      {syncLogs.length > 0 && (
        <div className="card p-5 max-w-2xl">
          <h3 className="text-sm font-semibold mb-3">Sync History</h3>
          <DataTable<SyncLog>
            columns={[
              { key: "timestamp", label: "Time", mono: true,
                render: (v) => new Date(String(v)).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) },
              { key: "month", label: "Month",
                render: (v, row) => `${getMonthName(Number(v))} ${row.year}` },
              { key: "transactionCount", label: "Records", align: "right", mono: true },
              { key: "status", label: "Status",
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

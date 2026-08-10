"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { getMonthName } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { settings, updateSettings, transactions, customers, syncLogs } = useStore();
  const [dangerMessage, setDangerMessage] = useState("");
  const [dangerBusy, setDangerBusy] = useState<"transactions" | "customers" | "all" | null>(null);

  if (status === "loading") return null;
  if (session?.role !== "admin") {
    return (
      <div className="p-6">
        <div className="card p-6 max-w-md text-sm text-gray-600">
          Settings is only available to admin accounts.
        </div>
      </div>
    );
  }

  const clearTransactionsOnServer = async () => {
    if (!confirm("Clear ALL your transaction data from the server? This cannot be undone.")) return;
    setDangerBusy("transactions");
    setDangerMessage("");
    try {
      const res = await apiFetch("/api/transactions/all", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to clear transactions");
      useStore.getState().clearTransactions();
      setDangerMessage("All transactions deleted from the server.");
    } catch (err) {
      setDangerMessage(`Error: ${err instanceof Error ? err.message : "Failed to clear transactions"}`);
    } finally {
      setDangerBusy(null);
    }
  };

  const clearCustomersOnServer = async () => {
    if (!confirm("Clear ALL your customer data from the server? This cannot be undone.")) return;
    setDangerBusy("customers");
    setDangerMessage("");
    try {
      const res = await apiFetch("/api/customers?all=true", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to clear customers");
      useStore.getState().setCustomers([]);
      setDangerMessage("All customers deleted from the server.");
    } catch (err) {
      setDangerMessage(`Error: ${err instanceof Error ? err.message : "Failed to clear customers"}`);
    } finally {
      setDangerBusy(null);
    }
  };

  const factoryResetOnServer = async () => {
    if (!confirm("Factory Reset — permanently delete ALL your transaction data AND ALL your customer data from the server? This cannot be undone.")) return;
    setDangerBusy("all");
    setDangerMessage("");
    try {
      const res = await apiFetch("/api/reset-all", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to reset");
      localStorage.removeItem("fps-manager-storage");
      window.location.reload();
    } catch (err) {
      setDangerMessage(`Error: ${err instanceof Error ? err.message : "Failed to reset"}`);
      setDangerBusy(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">⚙️ Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure your FPS details</p>
      </div>

      {/* FPS Config */}
      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">FPS Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">FPS Name</label>
            <input value={settings.fpsName || ""}
              onChange={(e) => updateSettings({ fpsName: e.target.value })}
              placeholder="My Fair Price Shop" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                District Code <span className="font-normal text-gray-400">(from your login)</span>
              </label>
              <input value={settings.distCode} readOnly disabled
                className="input-field bg-gray-100 text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                FPS ID <span className="font-normal text-gray-400">(from your login)</span>
              </label>
              <input value={settings.fpsId} readOnly disabled
                className="input-field bg-gray-100 text-gray-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Default Month</label>
              <select value={settings.month}
                onChange={(e) => updateSettings({ month: e.target.value })}
                className="input-field">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Default Year</label>
              <input value={settings.year}
                onChange={(e) => updateSettings({ year: e.target.value })}
                className="input-field" />
            </div>
          </div>
        </div>
      </div>

      {/* Data Stats */}
      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">Data Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold font-mono text-blue-600">{transactions.length}</div>
            <div className="text-xs text-gray-500 mt-1">Transactions</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold font-mono text-emerald-600">{customers.length}</div>
            <div className="text-xs text-gray-500 mt-1">Customers</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold font-mono text-violet-600">{syncLogs.length}</div>
            <div className="text-xs text-gray-500 mt-1">Sync Logs</div>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">Tech Stack</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            "Next.js 15 + TypeScript",
            "Tailwind CSS",
            "Cheerio (HTML Parser)",
            "Recharts (Charts)",
            "Zustand (State)",
            "SheetJS (Excel Import)",
            "jsPDF (PDF Export)",
            "Vercel (Deploy)",
          ].map((t) => (
            <div key={t} className="px-3 py-2 bg-gray-50 rounded-lg text-xs font-medium text-gray-700">
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-red-200">
        <h3 className="text-base font-semibold mb-3 text-red-600">Danger Zone</h3>
        <p className="text-xs text-gray-500 mb-3">
          These delete data permanently from the server (Vercel Blob), scoped only to your own
          login ({settings.fpsId}) — other dealers&apos; data is never affected.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Clear All Transactions</div>
              <div className="text-xs text-gray-500">Remove all fetched transaction data from the server</div>
            </div>
            <button onClick={clearTransactionsOnServer} disabled={dangerBusy !== null}
              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
              {dangerBusy === "transactions" ? "Clearing…" : "Clear"}
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <div className="text-sm font-medium">Clear All Customers</div>
              <div className="text-xs text-gray-500">Remove customer master data from the server</div>
            </div>
            <button onClick={clearCustomersOnServer} disabled={dangerBusy !== null}
              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50">
              {dangerBusy === "customers" ? "Clearing…" : "Clear"}
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <div className="text-sm font-medium">Factory Reset</div>
              <div className="text-xs text-gray-500">
                Permanently delete ALL transaction data AND ALL customer data from the server, in one go
              </div>
            </div>
            <button onClick={factoryResetOnServer} disabled={dangerBusy !== null}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
              {dangerBusy === "all" ? "Resetting…" : "Factory Reset"}
            </button>
          </div>
          {dangerMessage && (
            <div className={`text-xs px-3 py-2 rounded-lg ${
              dangerMessage.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              {dangerMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useStore } from "@/store/useStore";
import { getMonthName } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, updateSettings, transactions, customers, syncLogs } = useStore();

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
              <label className="text-xs font-semibold text-gray-500 block mb-1">District Code</label>
              <input value={settings.distCode}
                onChange={(e) => updateSettings({ distCode: e.target.value })}
                className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">FPS ID</label>
              <input value={settings.fpsId}
                onChange={(e) => updateSettings({ fpsId: e.target.value })}
                className="input-field" />
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Clear All Transactions</div>
              <div className="text-xs text-gray-500">Remove all fetched transaction data</div>
            </div>
            <button onClick={() => {
              if (confirm("Clear all transactions?")) useStore.getState().clearTransactions();
            }} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
              Clear
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <div className="text-sm font-medium">Clear All Customers</div>
              <div className="text-xs text-gray-500">Remove customer master data</div>
            </div>
            <button onClick={() => {
              if (confirm("Clear all customers?")) useStore.getState().setCustomers([]);
            }} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
              Clear
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div>
              <div className="text-sm font-medium">Reset Everything</div>
              <div className="text-xs text-gray-500">Clear all data and reset to defaults</div>
            </div>
            <button onClick={() => {
              if (confirm("Reset EVERYTHING? This cannot be undone.")) {
                localStorage.removeItem("fps-manager-storage");
                window.location.reload();
              }
            }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700">
              Reset All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

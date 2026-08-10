"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { KPICard, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/apiFetch";
import { formatNumber, getMonthName } from "@/lib/utils";
import type { InventoryItem } from "@/types";

export default function InventoryPage() {
  const { settings, inventoryItems, inventoryLedger, setInventoryItems, setInventoryLedger, addInventoryItem } =
    useStore();

  const [monthFilter, setMonthFilter] = useState(settings.month);
  const [yearFilter, setYearFilter] = useState(settings.year);
  const [loading, setLoading] = useState(true);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const yearOptions = useMemo(() => {
    const y = parseInt(settings.year, 10) || new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  }, [settings.year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1));

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/inventory?year=${yearFilter}&month=${monthFilter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inventory");
      setInventoryItems(data.items);
      setInventoryLedger(data.ledger);
      setReceivedDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter, yearFilter]);

  async function saveReceived(itemId: string) {
    const raw = receivedDrafts[itemId];
    if (raw === undefined) return;
    const received = Number(raw) || 0;
    try {
      const res = await apiFetch("/api/inventory/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: yearFilter, month: monthFilter, itemId, received }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setInventoryLedger(
        inventoryLedger.some((l) => l.itemId === itemId)
          ? inventoryLedger.map((l) => (l.itemId === itemId ? data.entry : l))
          : [...inventoryLedger, data.entry]
      );
      setReceivedDrafts((d) => {
        const next = { ...d };
        delete next[itemId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleAddItem() {
    if (!newItemName.trim() || !newItemUnit.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await apiFetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newItemName.trim(), unit: newItemUnit.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");
      addInventoryItem(data.item as InventoryItem);
      setNewItemName("");
      setNewItemUnit("");
      await loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  }

  const ledgerByItem = useMemo(
    () => new Map(inventoryLedger.map((l) => [l.itemId, l])),
    [inventoryLedger]
  );

  const totals = useMemo(
    () =>
      inventoryLedger.reduce(
        (acc, l) => ({
          received: acc.received + l.received,
          distributed: acc.distributed + l.distributed,
          closing: acc.closing + l.closing,
        }),
        { received: 0, distributed: 0, closing: 0 }
      ),
    [inventoryLedger]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📦 Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            FPS {settings.fpsId} · {getMonthName(parseInt(monthFilter))} {yearFilter}
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-32 text-xs"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {getMonthName(parseInt(m))}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="input-field w-24 text-xs"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm bg-red-50 text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-gray-400">Loading…</div>
      ) : inventoryItems.length === 0 ? (
        <EmptyState icon="📦" title="No inventory items" description="Add an item below to get started." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard label="Total Received" value={formatNumber(totals.received)} sub="This month" color="blue" icon="🚚" />
            <KPICard label="Total Distributed" value={formatNumber(totals.distributed)} sub="This month" color="green" icon="📤" />
            <KPICard label="Carried Forward" value={formatNumber(totals.closing)} sub="To next month" color="purple" icon="➡️" />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">Monthly Stock Ledger</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {["Item", "Unit", "Opening", "Received", "Distributed", "Closing"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-xs font-semibold tracking-wide text-white bg-brand-700 whitespace-nowrap text-right first:text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryItems.map((item, i) => {
                    const entry = ledgerByItem.get(item.id);
                    const draft = receivedDrafts[item.id];
                    return (
                      <tr
                        key={item.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                      >
                        <td className="px-3 py-2 font-semibold text-gray-800">{item.name}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{item.unit}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(entry?.opening ?? 0)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="input-field w-24 text-xs text-right"
                            value={draft ?? entry?.received ?? ""}
                            placeholder="0"
                            onChange={(e) =>
                              setReceivedDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                            }
                            onBlur={() => saveReceived(item.id)}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(entry?.distributed ?? 0)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">
                          {formatNumber(entry?.closing ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Add Item</h3>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            className="input-field w-48 text-xs"
            placeholder="Item name (e.g. Sugar)"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <input
            className="input-field w-28 text-xs"
            placeholder="Unit (e.g. Kg)"
            value={newItemUnit}
            onChange={(e) => setNewItemUnit(e.target.value)}
          />
          <button
            onClick={handleAddItem}
            disabled={adding || !newItemName.trim() || !newItemUnit.trim()}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}

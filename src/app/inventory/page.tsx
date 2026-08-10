"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { KPICard, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/apiFetch";
import { formatNumber, getMonthName } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";

interface AggregateRow extends InventoryLedgerEntry {
  dealerName: string;
  itemName: string;
  unit: string;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const {
    settings,
    inventoryItems,
    inventoryLedger,
    setInventoryItems,
    setInventoryLedger,
    addInventoryItem,
    viewingDealer,
  } = useStore();
  const isAdmin = session?.role === "admin";
  const readOnly = isAdmin;
  const aggregateMode = isAdmin && !viewingDealer;

  const [monthFilter, setMonthFilter] = useState(settings.month);
  const [yearFilter, setYearFilter] = useState(settings.year);
  const isAllMonths = monthFilter === "ALL";
  const [loading, setLoading] = useState(true);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [aggregateRows, setAggregateRows] = useState<AggregateRow[]>([]);
  const [yearlyMonthly, setYearlyMonthly] = useState<Record<string, InventoryLedgerEntry[]>>({});

  const [showOpeningForm, setShowOpeningForm] = useState(false);
  const [openingDrafts, setOpeningDrafts] = useState<Record<string, string>>({});
  const [savingOpening, setSavingOpening] = useState(false);
  const [openingMessage, setOpeningMessage] = useState("");

  const yearOptions = useMemo(() => {
    const y = parseInt(settings.year, 10) || new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  }, [settings.year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1));

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      if (isAllMonths && !aggregateMode) {
        const viewParam = viewingDealer ? `&viewFpsId=${encodeURIComponent(viewingDealer.fpsId)}` : "";
        const res = await apiFetch(`/api/inventory/yearly?year=${yearFilter}${viewParam}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load inventory");
        setInventoryItems(data.items);
        setYearlyMonthly(data.monthly);
        return;
      }
      if (aggregateMode) {
        const res = await apiFetch(`/api/inventory?year=${yearFilter}&month=${isAllMonths ? settings.month : monthFilter}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load inventory");
        setAggregateRows(data.rows);
        return;
      }
      const viewParam = viewingDealer ? `&viewFpsId=${encodeURIComponent(viewingDealer.fpsId)}` : "";
      const res = await apiFetch(`/api/inventory?year=${yearFilter}&month=${monthFilter}${viewParam}`);
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
  }, [monthFilter, yearFilter, viewingDealer?.fpsId, aggregateMode]);

  async function saveReceived(itemId: string) {
    if (readOnly) return;
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
    if (readOnly || !newItemName.trim() || !newItemUnit.trim()) return;
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

  function openOpeningForm() {
    const drafts: Record<string, string> = {};
    for (const item of inventoryItems) {
      drafts[item.id] = String(ledgerByItem.get(item.id)?.opening ?? 0);
    }
    setOpeningDrafts(drafts);
    setOpeningMessage("");
    setShowOpeningForm(true);
  }

  async function saveOpeningBalances() {
    setSavingOpening(true);
    setOpeningMessage("");
    try {
      const balances = Object.entries(openingDrafts).map(([itemId, value]) => ({
        itemId,
        opening: Number(value) || 0,
      }));
      const res = await apiFetch("/api/inventory/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: yearFilter, month: monthFilter, balances }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save opening balances");
      await loadLedger();
      setShowOpeningForm(false);
    } catch (e) {
      setOpeningMessage(`Error: ${e instanceof Error ? e.message : "Failed to save opening balances"}`);
    } finally {
      setSavingOpening(false);
    }
  }

  const ledgerByItem = useMemo(
    () => new Map(inventoryLedger.map((l) => [l.itemId, l])),
    [inventoryLedger]
  );

  const totals = useMemo(() => {
    const rows = aggregateMode ? aggregateRows : inventoryLedger;
    return rows.reduce(
      (acc, l) => ({
        received: acc.received + l.received,
        distributed: acc.distributed + l.distributed,
        closing: acc.closing + l.closing,
      }),
      { received: 0, distributed: 0, closing: 0 }
    );
  }, [aggregateMode, aggregateRows, inventoryLedger]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📦 {t("inventory.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            FPS {settings.fpsId} · {isAllMonths ? yearFilter : `${getMonthName(parseInt(monthFilter))} ${yearFilter}`}
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          {!readOnly && !isAllMonths && (
            <button onClick={openOpeningForm} className="btn-secondary text-xs">
              {t("inventory.setOpeningBalances")}
            </button>
          )}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-32 text-xs"
          >
            <option value="ALL">{t("dashboard.allMonths")}</option>
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

      {showOpeningForm && !isAllMonths && (
        <div className="card p-5 border-blue-200">
          <h3 className="text-sm font-semibold mb-1">{t("inventory.setOpeningBalances")}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t("inventory.setOpeningBalancesDesc", { month: `${getMonthName(parseInt(monthFilter))} ${yearFilter}` })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {inventoryItems.map((item) => (
              <div key={item.id}>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  {item.name} ({item.unit})
                </label>
                <input
                  type="number"
                  className="input-field text-xs"
                  value={openingDrafts[item.id] ?? "0"}
                  onChange={(e) => setOpeningDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveOpeningBalances} disabled={savingOpening} className="btn-primary text-xs disabled:opacity-50">
              {savingOpening ? t("common.loading") : t("common.save")}
            </button>
            <button onClick={() => setShowOpeningForm(false)} className="btn-secondary text-xs">
              {t("common.cancel")}
            </button>
          </div>
          {openingMessage && (
            <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{openingMessage}</div>
          )}
        </div>
      )}

      {aggregateMode && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800">
          {t("common.readOnlyCollective")}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-gray-400">{t("common.loading")}</div>
      ) : isAllMonths && !aggregateMode ? (
        inventoryItems.length === 0 ? (
          <EmptyState icon="📦" title={t("inventory.noItemsTitle")} description={t("inventory.noItemsDesc")} />
        ) : (
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">{t("inventory.monthwiseClosing")} — {yearFilter}</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-white bg-brand-700 whitespace-nowrap">
                      {t("sync.month")}
                    </th>
                    {inventoryItems.map((item) => (
                      <th
                        key={item.id}
                        className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-white bg-brand-700 whitespace-nowrap"
                      >
                        {item.name} ({item.unit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthOptions.map((m, i) => {
                    const entries = yearlyMonthly[m] || [];
                    const byItem = new Map(entries.map((e) => [e.itemId, e]));
                    return (
                      <tr key={m} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                          {getMonthName(parseInt(m))}
                        </td>
                        {inventoryItems.map((item) => (
                          <td key={item.id} className="px-3 py-2 text-right font-mono">
                            {formatNumber(byItem.get(item.id)?.closing ?? 0)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : aggregateMode ? (
        aggregateRows.length === 0 ? (
          <EmptyState icon="📦" title={t("inventory.noDataTitle")} description={t("inventory.noDataDesc")} />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <KPICard label={t("inventory.totalReceived")} value={formatNumber(totals.received)} sub={`${t("inventory.thisMonth")}, ${t("inventory.allDealers").toLowerCase()}`} color="blue" icon="🚚" />
              <KPICard label={t("inventory.totalDistributed")} value={formatNumber(totals.distributed)} sub={`${t("inventory.thisMonth")}, ${t("inventory.allDealers").toLowerCase()}`} color="green" icon="📤" />
              <KPICard label={t("inventory.carriedForward")} value={formatNumber(totals.closing)} sub={`${t("inventory.toNextMonth")}, ${t("inventory.allDealers").toLowerCase()}`} color="purple" icon="➡️" />
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4">{t("inventory.monthlyStockLedger")} — {t("inventory.allDealers")}</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {[t("inventory.dealer"), t("inventory.item"), t("inventory.unit"), t("inventory.opening"), t("inventory.received"), t("inventory.distributed"), t("inventory.closing")].map((h) => (
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
                    {aggregateRows.map((row, i) => (
                      <tr
                        key={`${row.fpsId}-${row.itemId}`}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                      >
                        <td className="px-3 py-2 font-semibold text-gray-800">{row.dealerName}</td>
                        <td className="px-3 py-2 text-gray-700">{row.itemName}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.opening)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.received)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.distributed)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">
                          {formatNumber(row.closing)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      ) : inventoryItems.length === 0 ? (
        <EmptyState icon="📦" title={t("inventory.noItemsTitle")} description={t("inventory.noItemsDesc")} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard label={t("inventory.totalReceived")} value={formatNumber(totals.received)} sub={t("inventory.thisMonth")} color="blue" icon="🚚" />
            <KPICard label={t("inventory.totalDistributed")} value={formatNumber(totals.distributed)} sub={t("inventory.thisMonth")} color="green" icon="📤" />
            <KPICard label={t("inventory.carriedForward")} value={formatNumber(totals.closing)} sub={t("inventory.toNextMonth")} color="purple" icon="➡️" />
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">{t("inventory.monthlyStockLedger")}</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {[t("inventory.item"), t("inventory.unit"), t("inventory.opening"), t("inventory.received"), t("inventory.distributed"), t("inventory.closing")].map((h) => (
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
                            disabled={readOnly}
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

      {!readOnly && !isAllMonths && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">{t("inventory.addItem")}</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              className="input-field w-48 text-xs"
              placeholder={t("inventory.itemNamePlaceholder")}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <input
              className="input-field w-28 text-xs"
              placeholder={t("inventory.unitPlaceholder")}
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
            />
            <button
              onClick={handleAddItem}
              disabled={adding || !newItemName.trim() || !newItemUnit.trim()}
              className="btn-primary text-xs disabled:opacity-50"
            >
              {adding ? t("inventory.adding") : t("inventory.addItem")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

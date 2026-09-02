"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/apiFetch";
import { formatNumber, getMonthName } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";

interface AggregateRow extends InventoryLedgerEntry {
  dealerName: string;
  itemName: string;
  unit: string;
}

interface ScmSummaryRow {
  scheme: string;
  commodity: string;
  receivedQty: number;
  distributedQty: number;
  closingStock: number;
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
    viewingDealer,
  } = useStore();
  const isAdmin = session?.role === "admin";
  const readOnly = isAdmin;
  const aggregateMode = isAdmin && !viewingDealer;

  const [monthFilter, setMonthFilter] = useState(settings.month);
  const [yearFilter, setYearFilter] = useState(settings.year);
  const [loading, setLoading] = useState(true);
  const [receivedDrafts, setReceivedDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [aggregateRows, setAggregateRows] = useState<AggregateRow[]>([]);

  const [scmSummary, setScmSummary] = useState<ScmSummaryRow[]>([]);
  const [scmLoading, setScmLoading] = useState(false);
  const [scmSyncing, setScmSyncing] = useState(false);
  const [scmError, setScmError] = useState("");

  const yearOptions = useMemo(() => {
    const y = parseInt(settings.year, 10) || new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1)];
  }, [settings.year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1));

  // Received quantities come from the SCM inventory summary (fetched from the
  // govt portal), summed across schemes (AAY + PHH) per commodity — the
  // ledger no longer stores a separately-entered "received" figure for
  // commodity-linked items (wheat/rice/sugar/jowar). Non-linked items (e.g.
  // Saree Kit) still use the manually-entered ledger value.
  const scmReceivedByCommodity = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of scmSummary) {
      const key = row.commodity.trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + (row.receivedQty || 0));
    }
    return map;
  }, [scmSummary]);

  function receivedFor(txField: InventoryItem["txField"], ledgerReceived: number) {
    if (!txField) return ledgerReceived;
    return scmReceivedByCommodity.get(txField) ?? 0;
  }

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      if (aggregateMode) {
        const res = await apiFetch(`/api/inventory?year=${yearFilter}&month=${monthFilter}`);
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

  async function loadScmSummary() {
    if (aggregateMode) return;
    setScmLoading(true);
    setScmError("");
    try {
      const viewParam = viewingDealer ? `&viewFpsId=${encodeURIComponent(viewingDealer.fpsId)}` : "";
      const res = await apiFetch(`/api/inventory/scm?year=${yearFilter}&month=${monthFilter}${viewParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load SCM inventory summary");
      setScmSummary(data.rows || []);
    } catch (e) {
      setScmError(e instanceof Error ? e.message : "Failed to load SCM inventory summary");
    } finally {
      setScmLoading(false);
    }
  }

  useEffect(() => {
    loadScmSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthFilter, yearFilter, viewingDealer?.fpsId, aggregateMode]);

  async function syncScmStock() {
    setScmSyncing(true);
    setScmError("");
    try {
      const res = await apiFetch("/api/inventory/scm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: yearFilter,
          month: monthFilter,
          viewFpsId: viewingDealer?.fpsId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync SCM inventory");
      setScmSummary(data.summary || []);
      await loadScmSummary();
    } catch (e) {
      setScmError(e instanceof Error ? e.message : "Failed to sync SCM inventory");
    } finally {
      setScmSyncing(false);
    }
  }

  async function recomputeScmSummary() {
    setScmSyncing(true);
    setScmError("");
    try {
      const res = await apiFetch("/api/inventory/scm/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: yearFilter, viewFpsId: viewingDealer?.fpsId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to recalculate SCM inventory");
      await loadScmSummary();
    } catch (e) {
      setScmError(e instanceof Error ? e.message : "Failed to recalculate SCM inventory");
    } finally {
      setScmSyncing(false);
    }
  }

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

  const ledgerByItem = useMemo(
    () => new Map(inventoryLedger.map((l) => [l.itemId, l])),
    [inventoryLedger]
  );

  // Per-item summary (never summed across items) — Wheat is Kg, Saree Kit
  // is Pcs, etc., so a single combined "Total Distributed" number mixing
  // every item's unit together would be meaningless.
  const itemSummaries = useMemo(() => {
    if (aggregateMode) {
      const byItem = new Map<string, { name: string; unit: string; received: number; distributed: number; closing: number; }>();
      for (const row of aggregateRows) {
        const existing = byItem.get(row.itemName);
        byItem.set(row.itemName, {
          name: row.itemName,
          unit: row.unit,
          received: (existing?.received ?? 0) + row.received,
          distributed: (existing?.distributed ?? 0) + row.distributed,
          closing: (existing?.closing ?? 0) + row.closing,
        });
      }
      return Array.from(byItem.values());
    }
    return inventoryItems.map((item) => {
      const entry = ledgerByItem.get(item.id);
      const received = receivedFor(item.txField, entry?.received ?? 0);
      const distributed = entry?.distributed ?? 0;
      return {
        name: item.name,
        unit: item.unit,
        received,
        distributed,
        closing: received - distributed,
      };
    });
  }, [aggregateMode, aggregateRows, inventoryItems, ledgerByItem, scmReceivedByCommodity]);

  const itemSummaryCards = itemSummaries.length > 0 && (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {itemSummaries.map((s) => (
        <div key={s.name} className="card p-4 border-l-4 border-l-blue-600">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">
            {s.name} <span className="font-normal normal-case text-gray-400">({s.unit})</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-base font-bold font-mono text-blue-600">{formatNumber(s.received)}</div>
              <div className="text-[10px] text-gray-400">{t("inventory.received")}</div>
            </div>
            <div>
              <div className="text-base font-bold font-mono text-emerald-600">{formatNumber(s.distributed)}</div>
              <div className="text-[10px] text-gray-400">{t("inventory.distributed")}</div>
            </div>
            <div>
              <div className="text-base font-bold font-mono text-violet-600">{formatNumber(s.closing)}</div>
              <div className="text-[10px] text-gray-400">{t("inventory.closing")}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📦 {t("inventory.title")}</h1>
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

      {aggregateMode && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800">
          {t("common.readOnlyCollective")}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center text-gray-400">{t("common.loading")}</div>
      ) : aggregateMode ? (
        aggregateRows.length === 0 ? (
          <EmptyState icon="📦" title={t("inventory.noDataTitle")} description={t("inventory.noDataDesc")} />
        ) : (
          <>
            {itemSummaryCards}

            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4">{t("inventory.monthlyStockLedger")} — {t("inventory.allDealers")}</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {[t("inventory.dealer"), t("inventory.item"), t("inventory.unit"), t("inventory.received"), t("inventory.distributed"), t("inventory.closing")].map((h) => (
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
          {itemSummaryCards}

          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">{t("inventory.monthlyStockLedger")}</h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {[t("inventory.item"), t("inventory.unit"), t("inventory.received"), t("inventory.distributed"), t("inventory.closing")].map((h) => (
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
                    const linkedToScm = !!item.txField;
                    const received = receivedFor(item.txField, entry?.received ?? 0);
                    const distributed = entry?.distributed ?? 0;
                    return (
                      <tr
                        key={item.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                      >
                        <td className="px-3 py-2 font-semibold text-gray-800">{item.name}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{item.unit}</td>
                        <td className="px-3 py-2 text-right">
                          {linkedToScm ? (
                            <span className="font-mono" title="From SCM inventory (govt portal) sync">
                              {formatNumber(received)}
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(distributed)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">
                          {formatNumber(received - distributed)}
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

      {!aggregateMode && (
        <div className="card p-5">
          <div className="flex justify-between items-start flex-wrap gap-3 mb-1">
            <div>
              <h3 className="text-sm font-semibold">SCM inventory summary</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-2xl">Month-wise stock from Maharashtra SCM data, scheme- and commodity-wise. The Received column in the ledger above is drawn from this data.</p>
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <button onClick={recomputeScmSummary} disabled={scmSyncing} title="Recalculate distributed quantities from your transaction ledger for every synced month this year, without re-fetching from the SCM portal" className="btn-secondary text-xs disabled:opacity-50 whitespace-nowrap">
                  {scmSyncing ? "Working..." : "🧮 Recalculate"}
                </button>
                <button onClick={syncScmStock} disabled={scmSyncing} className="btn-secondary text-xs disabled:opacity-50 whitespace-nowrap">
                  {scmSyncing ? "Syncing..." : "🔄 Sync SCM"}
                </button>
              </div>
            )}
          </div>

          {scmError && <div className="mt-3 px-4 py-2 rounded-lg text-sm bg-red-50 text-red-600">{scmError}</div>}

          <div className="mt-4">
            {scmLoading ? (
              <div className="text-center text-gray-400 text-sm py-6">{t("common.loading")}</div>
            ) : scmSummary.length === 0 ? (
              <EmptyState icon="📦" title="No SCM stock data" description="Run the SCM sync to import this month’s records." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {['Scheme', 'Commodity', 'Received', 'Distributed', 'Closing'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-xs font-semibold tracking-wide text-white bg-brand-700 whitespace-nowrap text-right first:text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scmSummary.map((row, i) => (
                      <tr key={`${row.scheme}-${row.commodity}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 font-semibold text-gray-800">{row.scheme}</td>
                        <td className="px-3 py-2 text-gray-700">{row.commodity}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.receivedQty)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatNumber(row.distributedQty)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">{formatNumber(row.closingStock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

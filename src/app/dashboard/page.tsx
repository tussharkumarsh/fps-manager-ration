"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useStore } from "@/store/useStore";
import { KPICard, Badge, EmptyState } from "@/components/ui";
import { calculateMonthlyStats, calculateChartData, getMonthName, formatNumber, getDistinctMonths, getCurrentMonth, dateOnly, activeCustomers } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { apiFetch } from "@/lib/apiFetch";
import type { InventoryItem, InventoryLedgerEntry } from "@/types";

const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

interface StockRow {
  name: string;
  unit: string;
  received: number;
  distributed: number;
}

// Per-item received/distributed as stored in the inventory ledger. This is
// the fallback "received" source for items the SCM portal doesn't track
// (e.g. Saree Kit) — for wheat/rice/sugar/jowar, useScmReceived below
// overrides it with the real govt-sourced figure.
function useInventorySnapshot(month: string, year: string, viewingFpsId: string | undefined, aggregateMode: boolean) {
  const [stock, setStock] = useState<StockRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (aggregateMode) {
          const res = await apiFetch(`/api/inventory?year=${year}&month=${month}`);
          const data = await res.json();
          if (!res.ok || cancelled) return;
          const byItem = new Map<string, StockRow>();
          for (const row of data.rows as (InventoryLedgerEntry & { itemName: string; unit: string })[]) {
            const existing = byItem.get(row.itemName);
            byItem.set(row.itemName, {
              name: row.itemName,
              unit: row.unit,
              received: (existing?.received ?? 0) + row.received,
              distributed: (existing?.distributed ?? 0) + row.distributed,
            });
          }
          setStock(Array.from(byItem.values()));
          return;
        }
        const viewParam = viewingFpsId ? `&viewFpsId=${encodeURIComponent(viewingFpsId)}` : "";
        const res = await apiFetch(`/api/inventory?year=${year}&month=${month}${viewParam}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const items = data.items as InventoryItem[];
        const ledger = data.ledger as InventoryLedgerEntry[];
        const ledgerByItem = new Map(ledger.map((l) => [l.itemId, l]));
        setStock(
          items.map((item) => ({
            name: item.name,
            unit: item.unit,
            received: ledgerByItem.get(item.id)?.received ?? 0,
            distributed: ledgerByItem.get(item.id)?.distributed ?? 0,
          }))
        );
      } catch {
        // Non-fatal — the dashboard's main content doesn't depend on this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, year, viewingFpsId, aggregateMode]);

  return stock;
}

// Received quantities for the commodities the SCM portal tracks (wheat,
// rice, sugar, jowar), summed across schemes (AAY + PHH). Not available in
// aggregate (all-dealers) mode.
function useScmReceived(month: string, year: string, viewingFpsId: string | undefined, aggregateMode: boolean) {
  const [byCommodity, setByCommodity] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (aggregateMode) {
      setByCommodity(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const viewParam = viewingFpsId ? `&viewFpsId=${encodeURIComponent(viewingFpsId)}` : "";
        const res = await apiFetch(`/api/inventory/scm?year=${year}&month=${month}${viewParam}`);
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const map = new Map<string, number>();
        for (const row of (data.rows || []) as { commodity: string; receivedQty: number }[]) {
          const key = row.commodity.trim().toLowerCase();
          map.set(key, (map.get(key) ?? 0) + (row.receivedQty || 0));
        }
        if (!cancelled) setByCommodity(map);
      } catch {
        // Non-fatal — the dashboard's main content doesn't depend on this.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month, year, viewingFpsId, aggregateMode]);

  return byCommodity;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { transactions, customers: allCustomers, settings, viewingDealer } = useStore();
  const customers = useMemo(() => activeCustomers(allCustomers), [allCustomers]);
  const { t } = useTranslation();
  const aggregateMode = session?.role === "admin" && !viewingDealer;
  const scopeLabel = aggregateMode
    ? t("common.allDealersCollective")
    : `FPS ${viewingDealer?.fpsId ?? settings.fpsId}`;
  useAutoLoadMonth(settings.month, settings.year);

  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonth());
  const monthOptions = useMemo(() => getDistinctMonths(transactions), [transactions]);

  // "All Months" has no single closing balance to show (each month's
  // closing carries into the next, so summing them would double-count) —
  // it shows the current standing stock instead, i.e. the account's
  // default (real current) month. Picking a specific month shows the
  // stock as it stood at the end of that month.
  const [stockYear, stockMonth] =
    monthFilter === "ALL" ? [settings.year, settings.month] : monthFilter.split("-").map((v) => String(parseInt(v, 10)));
  const inventorySnapshot = useInventorySnapshot(stockMonth, stockYear, viewingDealer?.fpsId, aggregateMode);
  const scmReceived = useScmReceived(stockMonth, stockYear, viewingDealer?.fpsId, aggregateMode);

  const scopedTransactions = useMemo(() => {
    if (monthFilter === "ALL") return transactions;
    return transactions.filter((t) => dateOnly(t.date).slice(0, 7) === monthFilter);
  }, [transactions, monthFilter]);

  const stats = useMemo(() => calculateMonthlyStats(scopedTransactions), [scopedTransactions]);
  const chartData = useMemo(() => calculateChartData(scopedTransactions), [scopedTransactions]);

  const schemeData = useMemo(
    () => [
      { name: "PHH", value: stats.phhCount },
      { name: "AAY", value: stats.aayCount },
    ],
    [stats]
  );

  const authData = useMemo(
    () => [
      { name: "Authenticated", value: stats.authCount },
      { name: "OTP", value: stats.otpCount },
      { name: "IRIS", value: stats.irisCount },
    ],
    [stats]
  );

  const pendingCustomers = useMemo(() => {
    const collected = new Set(
      scopedTransactions.filter((t) => t.wheat > 0).map((t) => t.srcNo)
    );
    return customers.filter((c) => !collected.has(c.srcNo));
  }, [scopedTransactions, customers]);

  const stockAsOfLabel =
    monthFilter === "ALL"
      ? t("inventory.asOfNow")
      : `${t("inventory.asOfEndOf")} ${getMonthName(parseInt(stockMonth))} ${stockYear}`;

  const snapshotByName = useMemo(
    () => new Map(inventorySnapshot.map((s) => [s.name.toLowerCase(), s])),
    [inventorySnapshot]
  );

  // Received: SCM govt data for wheat/rice/sugar/jowar (summed across
  // schemes); the inventory ledger's manually-entered figure for items the
  // SCM portal doesn't track (e.g. Saree Kit). Distributed: always the
  // actual quantity handed out per transactions.
  const itemCards = useMemo(() => {
    const defs: { key: string; label: string; unit: string; icon: string; distributed: number }[] = [
      { key: "wheat", label: t("transactions.wheat"), unit: "Kg", icon: "🌾", distributed: stats.totalWheat },
      { key: "rice", label: t("transactions.rice"), unit: "Kg", icon: "🍚", distributed: stats.totalRice },
      { key: "sugar", label: t("transactions.sugar"), unit: "Kg", icon: "🧂", distributed: stats.totalSugar },
      { key: "jowar", label: t("transactions.jowar"), unit: "Kg", icon: "🌽", distributed: stats.totalJowar },
      {
        key: "saree kit",
        label: t("transactions.saree"),
        unit: snapshotByName.get("saree kit")?.unit ?? "Pcs",
        icon: "👘",
        distributed: stats.totalSaree,
      },
    ];
    return defs.map((d) => {
      const scm = scmReceived.get(d.key);
      const received = scm !== undefined ? scm : snapshotByName.get(d.key)?.received ?? 0;
      return { ...d, received, remaining: received - d.distributed };
    });
  }, [stats, scmReceived, snapshotByName, t]);

  const itemCardsSection = (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold">📦 {t("inventory.availableStock")}</h3>
        <span className="text-xs text-gray-400">{stockAsOfLabel}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {itemCards.map((s) => (
          <div key={s.key} className="card p-4 border-l-4 border-l-blue-600">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3">
              {s.icon} {s.label} <span className="font-normal normal-case text-gray-400">({s.unit})</span>
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
                <div className="text-base font-bold font-mono text-violet-600">{formatNumber(s.remaining)}</div>
                <div className="text-[10px] text-gray-400">{t("inventory.remaining")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold mb-2">📊 {t("dashboard.title")}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {scopeLabel} · {getMonthName(parseInt(settings.month))} {settings.year}
          </p>
        </div>
        {itemCardsSection}
        <EmptyState
          icon="📋"
          title={t("dashboard.noTransactionsTitle")}
          description={t("dashboard.noTransactionsDesc")}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📊 {t("dashboard.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {scopeLabel} · {getMonthName(parseInt(settings.month))} {settings.year} · {formatNumber(scopedTransactions.length)} record(s)
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">{t("dashboard.allMonths")}</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {monthFilter !== "ALL" && (
            <button
              onClick={() => setMonthFilter("ALL")}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {t("common.clearFilters")}
            </button>
          )}
        </div>
      </div>

      {/* Item cards: received (SCM govt data) / distributed (transactions) / remaining */}
      {itemCardsSection}

      {/* Family KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard label={t("dashboard.aayFamilies")} value={stats.aayCount} sub={t("dashboard.antyodaya")} color="yellow" icon="🎯" />
        <KPICard label={t("dashboard.phhFamilies")} value={stats.phhCount} sub={t("dashboard.priorityHousehold")} color="blue" icon="🏠" />
        <KPICard label={t("dashboard.totalFamilies")} value={customers.length} sub={t("dashboard.registered")} color="purple" icon="👨‍👩‍👧‍👦" />
        <KPICard label={t("dashboard.collected")} value={stats.uniqueCustomers} sub={t("dashboard.ofRegistered", { count: customers.length })} color="green" icon="✅" />
        <KPICard label={t("dashboard.pending")} value={pendingCustomers.length} sub={t("dashboard.notCollected")} color="red" icon="⚠️" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold mb-4">{t("dashboard.dailyDistribution")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }} />
              <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="wheat" fill="#2563eb" name="Wheat" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rice" fill="#059669" name="Rice" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sugar" fill="#d97706" name="Sugar" radius={[4, 4, 0, 0]} />
              <Bar dataKey="jowar" fill="#7c3aed" name="Jowar" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">{t("dashboard.schemeSplit")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={schemeData} cx="50%" cy="45%" innerRadius={45} outerRadius={75} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {schemeData.map((_, i) => (<Cell key={i} fill={COLORS[i]} />))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">{t("dashboard.authMethods")}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={authData} cx="50%" cy="45%" innerRadius={45} outerRadius={75} dataKey="value"
                label={({ name, percent }) => `${name.slice(0, 5)} ${(percent * 100).toFixed(0)}%`}>
                {authData.map((_, i) => (<Cell key={i} fill={COLORS[i + 2]} />))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Line */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">{t("dashboard.dailyTransactionsByScheme")}</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }} />
            <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="phh" stroke="#2563eb" strokeWidth={2} name="PHH" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="aay" stroke="#d97706" strokeWidth={2} name="AAY" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pending Customers */}
      {pendingCustomers.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3 text-red-600">
            ⚠️ {t("dashboard.pendingCollection")} — {pendingCustomers.length}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {pendingCustomers.slice(0, 16).map((c) => (
              <div key={c.srcNo} className="flex justify-between items-center px-3 py-2 bg-red-50 rounded-lg text-xs">
                <span className="font-semibold text-gray-800">{c.name}</span>
                <span className="text-gray-500 font-mono">{c.srcNo.slice(-6)}</span>
              </div>
            ))}
            {pendingCustomers.length > 16 && (
              <div className="flex items-center justify-center px-3 py-2 bg-red-50 rounded-lg text-xs text-red-600 font-medium">
                +{pendingCustomers.length - 16} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

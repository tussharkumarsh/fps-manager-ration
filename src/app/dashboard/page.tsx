"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { useStore } from "@/store/useStore";
import { KPICard, Badge, EmptyState } from "@/components/ui";
import { calculateMonthlyStats, calculateChartData, getMonthName, formatNumber, getDistinctMonths, dateOnly } from "@/lib/utils";
import { useAutoLoadMonth } from "@/hooks/useAutoLoadMonth";

const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export default function DashboardPage() {
  const { transactions, customers, settings } = useStore();
  useAutoLoadMonth(settings.month, settings.year);

  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const monthOptions = useMemo(() => getDistinctMonths(transactions), [transactions]);

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

  if (transactions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">📊 Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">
          FPS {settings.fpsId} · {getMonthName(parseInt(settings.month))} {settings.year}
        </p>
        <EmptyState
          icon="📋"
          title="No transactions yet"
          description="Go to Sync Data to fetch transactions from the ePOS system, or import your Excel file in the Customers section."
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">📊 Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            FPS {settings.fpsId} · {getMonthName(parseInt(settings.month))} {settings.year} · {formatNumber(scopedTransactions.length)} record(s)
          </p>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
            className="input-field w-36 text-xs">
            <option value="ALL">All Months</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {monthFilter !== "ALL" && (
            <button
              onClick={() => setMonthFilter("ALL")}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Wheat" value={`${formatNumber(stats.totalWheat)} Kg`} sub={`${stats.activeDays} active days`} color="blue" icon="🌾" />
        <KPICard label="Total Rice" value={`${formatNumber(stats.totalRice)} Kg`} sub="PHH + AAY" color="green" icon="🍚" />
        <KPICard label="PHH Families" value={stats.phhCount} sub="Priority Household" color="blue" icon="🏠" />
        <KPICard label="AAY Families" value={stats.aayCount} sub="Antyodaya" color="yellow" icon="🎯" />
        <KPICard label="Unique Customers" value={stats.uniqueCustomers} sub={`of ${customers.length} registered`} color="purple" icon="👥" />
        <KPICard label="Pending" value={pendingCustomers.length} sub="Not collected" color="red" icon="⚠️" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold mb-4">Daily Distribution (Kgs)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={11} tick={{ fill: "#94a3b8" }} />
              <YAxis fontSize={11} tick={{ fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="wheat" fill="#2563eb" name="Wheat" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rice" fill="#059669" name="Rice" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-4">Scheme Split</h3>
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
          <h3 className="text-sm font-semibold mb-4">Auth Methods</h3>
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
        <h3 className="text-sm font-semibold mb-4">Daily Transactions by Scheme</h3>
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
            ⚠️ Pending Collection — {pendingCustomers.length} customers
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

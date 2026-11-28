"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui";
import { ShopTag } from "@/components/otherShops/ShopDialog";
import { useStore } from "@/store/useStore";
import { cn, formatNumber, getMonthName } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { FamilySummary, SchemeCount } from "@/lib/familySummary";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Every registered family, active and disabled (as on Customer Master). */
const allRegistered = (s: FamilySummary): SchemeCount => ({
  total: s.registered.total + s.disabledRegistered.total,
  phh: s.registered.phh + s.disabledRegistered.phh,
  aay: s.registered.aay + s.disabledRegistered.aay,
});

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${getMonthName(parseInt(m, 10))} ${y}`;
}

function SchemeRows({ count, of }: { count: SchemeCount; of?: SchemeCount }) {
  const rows: { key: "phh" | "aay"; label: string; bar: string }[] = [
    { key: "phh", label: "PHH", bar: "bg-blue-600" },
    { key: "aay", label: "AAY", bar: "bg-amber-500" },
  ];
  return (
    <div className="mt-3 space-y-2">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-gray-600">{r.label}</span>
            <span className="font-mono font-semibold text-gray-800">
              {formatNumber(count[r.key])}
              {of && <span className="font-normal text-gray-400"> / {formatNumber(of[r.key])}</span>}
            </span>
          </div>
          {of && (
            <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={cn("h-full rounded-full", r.bar)} style={{ width: `${pct(count[r.key], of[r.key])}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Tile({
  accent, icon, label, value, sub, children, onClick, active,
}: {
  accent: string; icon: string; label: string; value: number; sub?: ReactNode;
  children?: ReactNode; onClick?: () => void; active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "card p-4 border-l-4",
        accent,
        onClick && "cursor-pointer transition-shadow hover:shadow-apple-lg",
        active && "ring-2 ring-blue-600"
      )}
    >
      <div className="text-[13px] font-medium text-gray-500">{icon} {label}</div>
      <div className="mt-1 text-[28px] leading-tight font-semibold font-mono text-gray-900">{formatNumber(value)}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {children}
    </div>
  );
}

/**
 * Spells out how the family figures add up: every family served at this
 * shop is exactly one of own customer, disabled, other shop or own card
 * not in master; registered = active + disabled; and active = took ration
 * + not taken.
 */
function FamilyEquations({ s, fileMode }: { s: FamilySummary; fileMode: boolean }) {
  const { t } = useTranslation();
  const n = (v: number) => <b className="font-semibold text-gray-900">{formatNumber(v)}</b>;
  return (
    <div className="mb-4 space-y-1.5 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
      <div>
        🏪 {n(s.servedByScheme.total)} {t("dashboard.eqServedAtShop")} ={" "}
        <span className="text-emerald-700">{n(s.collected.total)} {t("dashboard.eqMyCustomers")}</span>
        {" + "}<span className="text-amber-700">{n(s.disabledServed.total)} {t("dashboard.eqDisabled")}</span>
        {" + "}<span className="text-cyan-700">{n(s.otherShop.total)} {t("dashboard.eqOtherShop")}</span>
        {" + "}<span className="text-indigo-700">{n(s.unlisted.total)} {t(fileMode ? "dashboard.eqNotInFile" : "dashboard.eqNotInMaster")}</span>
      </div>
      <div>
        👥 {n(allRegistered(s).total)} {t("dashboard.eqRegistered")} ={" "}
        <span className="text-gray-800">{n(s.registered.total)} {t("dashboard.eqActive")}</span>
        {" + "}<span className="text-amber-700">{n(s.disabledRegistered.total)} {t("dashboard.eqDisabled")}</span>
      </div>
      <div>
        ✅ {n(s.registered.total)} {t("dashboard.eqActive")} ={" "}
        <span className="text-emerald-700">{n(s.collected.total)} {t("dashboard.eqTook")}</span>
        {" + "}<span className="text-red-600">{n(s.pending.total)} {t("dashboard.eqNotTaken")}</span>
      </div>
    </div>
  );
}

type ListTab = "pending" | "otherShop" | "unlisted" | "disabled";
type SchemeFilter = "ALL" | "PHH" | "AAY";

export function FamilySummarySection({
  summary, isAllMonths, monthCount, fileMode = false,
}: {
  summary: FamilySummary; isAllMonths: boolean; monthCount: number;
  /** The dealer's customers are his latest government file's cards. */
  fileMode?: boolean;
}) {
  const { t } = useTranslation();
  const unlistedLabel = t(fileMode ? "dashboard.notInFileFamilies" : "dashboard.unlistedFamilies");
  const [tab, setTab] = useState<ListTab>("pending");
  const ownFps = useStore((st) => st.viewingDealer?.fpsId ?? st.settings.fpsId);
  const [schemeFilter, setSchemeFilter] = useState<SchemeFilter>("ALL");
  const [expanded, setExpanded] = useState(false);

  const s = summary;
  const totalServed = s.servedByScheme.total;

  // Other-shop families per home shop, most families first.
  const otherShopsByHome = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of s.otherShopFamilies) m.set(f.homeFps, (m.get(f.homeFps) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [s]);

  const rows = useMemo(() => {
    const keep = (scheme: string) => schemeFilter === "ALL" || scheme === schemeFilter;
    if (tab === "pending") {
      return s.pendingCustomers.filter((c) => keep(c.scheme)).map((c) => ({
        key: c.srcNo, name: c.name, srcNo: c.srcNo, scheme: c.scheme, extra: c.mobile || "",
      }));
    }
    if (tab === "otherShop") {
      return s.otherShopFamilies.filter((f) => keep(f.scheme)).map((f) => ({
        key: f.srcNo, name: f.name || "—", srcNo: f.srcNo, scheme: f.scheme,
        extra: `${f.transactions} ${t("dashboard.txns")}`, shop: f.homeFps,
      }));
    }
    if (tab === "unlisted") {
      return s.unlistedFamilies.filter((f) => keep(f.scheme)).map((f) => ({
        key: f.srcNo, name: f.name || "—", srcNo: f.srcNo, scheme: f.scheme,
        extra: `${f.transactions} ${t("dashboard.txns")}`, shop: "",
      }));
    }
    return s.disabledFamilies.filter((f) => keep(f.scheme)).map((f) => ({
      key: f.customer.srcNo, name: f.customer.name, srcNo: f.customer.srcNo, scheme: f.scheme,
      extra: `${f.transactions} ${t("dashboard.txns")}${f.customer.disabledReason ? ` · ${f.customer.disabledReason}` : ""}`,
    }));
  }, [s, tab, schemeFilter, t]);

  const LIMIT = 24;
  const visible = expanded ? rows : rows.slice(0, LIMIT);

  const tabs: { key: ListTab; label: string; count: number; tone: string }[] = [
    { key: "pending", label: t("dashboard.notTaken"), count: s.pending.total, tone: "text-red-600" },
    { key: "otherShop", label: t("dashboard.otherShopFamilies"), count: s.otherShop.total, tone: "text-cyan-700" },
    { key: "unlisted", label: unlistedLabel, count: s.unlisted.total, tone: "text-indigo-700" },
    { key: "disabled", label: t("dashboard.disabledFamilies"), count: s.disabledServed.total, tone: "text-amber-700" },
  ];
  const rowTone: Record<ListTab, string> = {
    pending: "bg-red-50", otherShop: "bg-cyan-50", unlisted: "bg-indigo-50", disabled: "bg-amber-50",
  };

  const openList = (next: ListTab) => {
    setTab(next);
    setExpanded(false);
    document.getElementById("family-lists")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-semibold">👨‍👩‍👧‍👦 {t("dashboard.familySummary")}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t("dashboard.familySummarySub")}</p>
          </div>
          <div className="text-xs text-gray-500">
            {t("dashboard.familiesServed", { count: formatNumber(totalServed) })} ·{" "}
            {t("dashboard.transactionsCount", { count: formatNumber(s.transactions) })}
          </div>
        </div>

        <FamilyEquations s={s} fileMode={fileMode} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Tile accent="border-l-violet-500" icon="📋" label={t("dashboard.registeredFamilies")}
            value={allRegistered(s).total}
            sub={t("dashboard.activeAndDisabled", {
              active: formatNumber(s.registered.total), disabled: formatNumber(s.disabledRegistered.total),
            })}>
            <SchemeRows count={allRegistered(s)} />
          </Tile>
          <Tile accent="border-l-emerald-500" icon="✅" label={t("dashboard.tookRation")}
            value={s.collected.total}
            sub={t("dashboard.ofActivePct", {
              count: formatNumber(s.registered.total), pct: pct(s.collected.total, s.registered.total),
            })}>
            <SchemeRows count={s.collected} of={s.registered} />
          </Tile>
          <Tile accent="border-l-red-500" icon="⚠️" label={t("dashboard.notTaken")}
            value={s.pending.total}
            sub={`${pct(s.pending.total, s.registered.total)}%`}
            onClick={() => openList("pending")} active={tab === "pending"}>
            <SchemeRows count={s.pending} of={s.registered} />
          </Tile>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Tile accent="border-l-cyan-500" icon="🔁" label={t("dashboard.otherShopFamilies")}
            value={s.otherShop.total} sub={t("dashboard.otherShopSub")}
            onClick={() => openList("otherShop")} active={tab === "otherShop"}>
            <SchemeRows count={s.otherShop} />
            {otherShopsByHome.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-[11px] font-medium text-gray-400 mb-1">{t("dashboard.homeShops")}</div>
                <ul className="space-y-1 text-xs">
                  {otherShopsByHome.map(([fps, count]) => (
                    <li key={fps || "unknown"} className="flex justify-between gap-2">
                      <ShopTag fps={fps} className="min-w-0 text-left text-cyan-800" />
                      <span className="font-mono text-gray-500 flex-shrink-0">{formatNumber(count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Tile>
          <Tile accent="border-l-indigo-500" icon="🆕" label={unlistedLabel}
            value={s.unlisted.total} sub={t(fileMode ? "dashboard.notInFileSub" : "dashboard.unlistedSub")}
            onClick={() => openList("unlisted")} active={tab === "unlisted"}>
            <SchemeRows count={s.unlisted} />
          </Tile>
          <Tile accent="border-l-amber-500" icon="🚫" label={t("dashboard.disabledFamilies")}
            value={s.disabledServed.total} sub={t("dashboard.disabledSub")}
            onClick={() => openList("disabled")} active={tab === "disabled"}>
            <SchemeRows count={s.disabledServed} />
          </Tile>
        </div>

        {isAllMonths && monthCount > 1 && (
          <p className="mt-4 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">ℹ️ {t("dashboard.allMonthsNote")}</p>
        )}
      </div>

      <div id="family-lists" className="card p-5 scroll-mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
            {tabs.map((tb) => (
              <button key={tb.key} onClick={() => { setTab(tb.key); setExpanded(false); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                  tab === tb.key ? "bg-white shadow-sm " + tb.tone : "text-gray-500 hover:text-gray-700"
                )}>
                {tb.label} <span className="font-mono">({formatNumber(tb.count)})</span>
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["ALL", "PHH", "AAY"] as SchemeFilter[]).map((f) => (
              <button key={f} onClick={() => { setSchemeFilter(f); setExpanded(false); }}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border transition",
                  schemeFilter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                )}>
                {f === "ALL" ? t("dashboard.all") : f}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">{t("dashboard.noneHere")}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {visible.map((r) => (
              <div key={r.key} className={cn("px-3 py-2 rounded-lg text-xs", rowTone[tab])}>
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-gray-800 truncate">{r.name}</span>
                  <Badge text={r.scheme} />
                </div>
                <div className="flex justify-between gap-2 mt-0.5 text-gray-500">
                  <span className="font-mono">{r.srcNo}</span>
                  {r.extra && <span className="truncate text-right">{r.extra}</span>}
                </div>
                {"shop" in r && (
                  // Wraps rather than truncates: a long shop name must stay readable.
                  <div className="mt-1 flex items-start gap-1 text-cyan-800 break-words">
                    <span aria-hidden>🏪</span>
                    {r.shop
                      ? <ShopTag fps={String(r.shop)} className="min-w-0 text-left" />
                      : <span className="text-indigo-700">{t("reports.ownShop")} · <span className="font-mono">{ownFps}</span></span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {rows.length > LIMIT && (
          <button onClick={() => setExpanded((v) => !v)} className="mt-3 text-xs text-blue-600 hover:underline">
            {expanded ? t("dashboard.showLess") : t("dashboard.showAll", { count: formatNumber(rows.length) })}
          </button>
        )}
      </div>
    </>
  );
}

export function MonthWiseFamilyTable({
  rows, selected, onSelect, fileMode = false,
}: {
  rows: { month: string; summary: FamilySummary }[];
  selected: string;
  onSelect: (month: string) => void;
  fileMode?: boolean;
}) {
  const { t } = useTranslation();
  const th = "px-3 py-2 text-right font-semibold whitespace-nowrap";
  const td = "px-3 py-2 text-right font-mono whitespace-nowrap";
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold">📅 {t("dashboard.monthWise")}</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{t("dashboard.monthWiseNote")}</p>
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500">
              <th className="px-3 pt-2 text-left font-semibold" rowSpan={2}>{t("dashboard.month")}</th>
              <th className={cn(th, "text-center text-gray-700 border-b border-gray-200")} colSpan={5}>
                🏪 {t("dashboard.servedAtShop")}
              </th>
              <th className="w-3" rowSpan={2} />
              <th className={cn(th, "text-center text-gray-700 border-b border-gray-200")} colSpan={4}>
                👥 {t("dashboard.masterGroup")}
              </th>
            </tr>
            <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <th className={cn(th, "text-gray-800")}>{t("dashboard.total")}</th>
              <th className={cn(th, "text-emerald-700")}>= {t("dashboard.myCustomers")}</th>
              <th className={cn(th, "text-amber-700")}>+ {t("dashboard.disabledShort")}</th>
              <th className={cn(th, "text-cyan-700")}>+ {t("dashboard.otherShopShort")}</th>
              <th className={cn(th, "text-indigo-700")}>+ {t(fileMode ? "dashboard.notInFileShort" : "dashboard.notInMasterShort")}</th>
              <th className={th}>{t("dashboard.registeredShort")}</th>
              <th className={cn(th, "text-gray-800")}>{t("dashboard.activeShort")}</th>
              <th className={cn(th, "text-emerald-700")}>= {t("dashboard.tookRation")}</th>
              <th className={cn(th, "text-red-600")}>+ {t("dashboard.notTaken")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ month, summary: s }) => {
              const split = (c: SchemeCount) => `PHH ${c.phh} · AAY ${c.aay}`;
              return (
                <tr key={month} onClick={() => onSelect(month)}
                  className={cn(
                    "border-b border-gray-100 cursor-pointer hover:bg-blue-50/60",
                    month === selected && "bg-blue-50"
                  )}>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{monthLabel(month)}</td>
                  <td className={cn(td, "font-semibold text-gray-900")} title={split(s.servedByScheme)}>
                    {formatNumber(s.servedByScheme.total)}
                  </td>
                  <td className={cn(td, "text-emerald-700")} title={split(s.collected)}>{formatNumber(s.collected.total)}</td>
                  <td className={td} title={split(s.disabledServed)}>{formatNumber(s.disabledServed.total)}</td>
                  <td className={td} title={split(s.otherShop)}>{formatNumber(s.otherShop.total)}</td>
                  <td className={td} title={split(s.unlisted)}>{formatNumber(s.unlisted.total)}</td>
                  <td />
                  <td className={td} title={split(allRegistered(s))}>{formatNumber(allRegistered(s).total)}</td>
                  <td className={cn(td, "text-gray-800")} title={split(s.registered)}>{formatNumber(s.registered.total)}</td>
                  <td className={cn(td, "text-emerald-700")} title={split(s.collected)}>
                    {formatNumber(s.collected.total)}
                    <span className="ml-1 text-gray-400">{pct(s.collected.total, s.registered.total)}%</span>
                  </td>
                  <td className={cn(td, "font-semibold text-red-600")} title={split(s.pending)}>{formatNumber(s.pending.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

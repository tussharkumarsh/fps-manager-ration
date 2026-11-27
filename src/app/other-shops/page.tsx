"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { useOtherShops } from "@/store/useOtherShops";
import { ShopDialog } from "@/components/otherShops/ShopDialog";
import { EmptyState } from "@/components/ui";
import { seenOtherShops } from "@/lib/otherShops";
import { formatDate, formatNumber, dateOnly } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Row {
  fps: string;
  families: number;
  transactions: number;
  lastDate: string;
  shopName: string;
  dealerName: string;
  mobile: string;
  altMobile: string;
  address: string;
  notes: string;
  saved: boolean;
}

export default function OtherShopsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { transactions, customers, settings, viewingDealer } = useStore();
  const { shops, loading, error, readOnly } = useOtherShops();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const aggregateMode = session?.role === "admin" && !viewingDealer;

  // Every shop seen in the transactions, plus any saved by hand that hasn't
  // shown up in them (yet).
  const rows = useMemo<Row[]>(() => {
    const seen = seenOtherShops(transactions, customers);
    const savedMap = new Map(shops.map((s) => [s.shopFpsId, s]));
    const out: Row[] = seen.map((s) => {
      const d = savedMap.get(s.shopFpsId);
      return {
        fps: s.shopFpsId, families: s.families, transactions: s.transactions, lastDate: s.lastDate,
        shopName: d?.shopName ?? "", dealerName: d?.dealerName ?? "", mobile: d?.mobile ?? "",
        altMobile: d?.altMobile ?? "", address: d?.address ?? "", notes: d?.notes ?? "", saved: !!d,
      };
    });
    const seenIds = new Set(seen.map((s) => s.shopFpsId));
    for (const d of shops) {
      if (seenIds.has(d.shopFpsId)) continue;
      out.push({
        fps: d.shopFpsId, families: 0, transactions: 0, lastDate: "",
        shopName: d.shopName, dealerName: d.dealerName, mobile: d.mobile, altMobile: d.altMobile,
        address: d.address, notes: d.notes, saved: true,
      });
    }
    return out;
  }, [transactions, customers, shops]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.fps, r.shopName, r.dealerName, r.mobile, r.altMobile, r.address, r.notes].some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const unsaved = rows.filter((r) => !r.saved).length;

  if (aggregateMode) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">🏪 {t("otherShops.title")}</h1>
        <EmptyState icon="🏪" title={t("otherShops.title")} description={t("otherShops.pickDealer")} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">🏪 {t("otherShops.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            FPS {viewingDealer?.fpsId ?? settings.fpsId} · {t("otherShops.subtitle")}
          </p>
        </div>
        {!readOnly && (
          <button onClick={() => setEditing("")} className="btn-primary text-sm">+ {t("otherShops.addShop")}</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.shopsSeen")}</div>
          <div className="text-[28px] font-semibold font-mono">{formatNumber(rows.filter((r) => r.transactions > 0).length)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.detailsSaved")}</div>
          <div className="text-[28px] font-semibold font-mono text-emerald-700">{formatNumber(rows.length - unsaved)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.detailsMissing")}</div>
          <div className="text-[28px] font-semibold font-mono text-amber-600">{formatNumber(unsaved)}</div>
        </div>
      </div>

      <div className="card p-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("otherShops.search")}
          className="input-field text-sm mb-4 max-w-md" />
        {error && <div className="mb-3 text-xs text-red-600">{error}</div>}
        {loading && rows.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">{t("otherShops.noShops")}</div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.fpsNo")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.shopName")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.dealerName")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.mobile")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.address")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("otherShops.families")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("otherShops.transactions")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.lastSeen")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.fps} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap">{r.fps}</td>
                    <td className="px-3 py-2">
                      {r.shopName || <span className="text-amber-600">{t("otherShops.notSaved")}</span>}
                      {r.notes && <div className="text-gray-400 mt-0.5">{r.notes}</div>}
                    </td>
                    <td className="px-3 py-2">{r.dealerName || "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {[r.mobile, r.altMobile].filter(Boolean).map((m) => (
                        <a key={m} href={`tel:${m}`} className="block text-blue-600 hover:underline font-mono">{m}</a>
                      ))}
                      {!r.mobile && !r.altMobile && "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">{r.address || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatNumber(r.families)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatNumber(r.transactions)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.lastDate ? formatDate(dateOnly(r.lastDate)) : "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button onClick={() => setEditing(r.fps)} className="text-blue-600 hover:underline">
                        {readOnly ? t("otherShops.view") : r.saved ? t("otherShops.edit") : t("otherShops.addDetails")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && <ShopDialog shopFpsId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

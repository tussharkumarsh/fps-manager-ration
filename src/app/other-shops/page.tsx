"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { useOtherShops } from "@/store/useOtherShops";
import { ShopDialog } from "@/components/otherShops/ShopDialog";
import { EmptyState } from "@/components/ui";
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
  ownerName: string;
  office: string;
  mobileMasked: string;
  totalCards: number | null;
  mapUrl: string;
  inPortal: boolean;
}

const officeCodeOf = (fps: string) => fps.slice(0, 7);

export default function OtherShopsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { settings, viewingDealer } = useStore();
  const { shops, seen, directory, loading, error, readOnly, syncOffice, reloadDirectory } = useOtherShops();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncLines, setSyncLines] = useState<{ code: string; ok: boolean; text: string }[]>([]);
  const aggregateMode = session?.role === "admin" && !viewingDealer;
  const ownFps = viewingDealer?.fpsId ?? settings.fpsId;

  // Every shop seen in the transactions, plus any saved by hand that hasn't
  // shown up in them (yet), with the portal directory's details.
  const rows = useMemo<Row[]>(() => {
    const savedMap = new Map(shops.map((s) => [s.shopFpsId, s]));
    const base = [
      ...seen,
      ...shops
        .filter((d) => !seen.some((s) => s.shopFpsId === d.shopFpsId))
        .map((d) => ({ shopFpsId: d.shopFpsId, families: 0, transactions: 0, lastDate: "" })),
    ];
    return base.map((s) => {
      const d = savedMap.get(s.shopFpsId);
      const p = directory.get(s.shopFpsId);
      return {
        fps: s.shopFpsId, families: s.families, transactions: s.transactions, lastDate: s.lastDate,
        shopName: d?.shopName ?? "", dealerName: d?.dealerName ?? "", mobile: d?.mobile ?? "",
        altMobile: d?.altMobile ?? "", address: d?.address ?? "", notes: d?.notes ?? "", saved: !!d,
        ownerName: p?.ownerName ?? "",
        office: p ? [p.afsoName, p.distName].filter(Boolean).join(", ") : "",
        mobileMasked: p?.mobileMasked ?? "",
        totalCards: p ? p.totalCards : null,
        mapUrl: p && p.latitude !== null && p.longitude !== null
          ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : "",
        inPortal: !!p,
      };
    });
  }, [seen, shops, directory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.fps, r.shopName, r.dealerName, r.ownerName, r.office, r.mobile, r.altMobile, r.address, r.notes]
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  const unsaved = rows.filter((r) => !r.saved).length;
  const notInPortal = rows.filter((r) => !r.inPortal).length;

  // The portal lists shops per AFSO office (first 7 digits of the FPS number):
  // fetch the dealer's own office plus every office an other shop belongs to.
  const officeCodes = useMemo(() => {
    const set = new Set<string>();
    if (/^\d{12}$/.test(ownFps)) set.add(officeCodeOf(ownFps));
    for (const r of rows) if (/^\d{7,}$/.test(r.fps)) set.add(officeCodeOf(r.fps));
    return Array.from(set).sort();
  }, [rows, ownFps]);

  const fetchFromPortal = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncLines([]);
    for (const code of officeCodes) {
      try {
        const count = await syncOffice(code);
        setSyncLines((prev) => [...prev, { code, ok: true, text: t("otherShops.officeFetched", { code, count }) }]);
      } catch (err) {
        setSyncLines((prev) => [...prev, { code, ok: false, text: `${code}: ${err instanceof Error ? err.message : "Failed"}` }]);
      }
    }
    await reloadDirectory();
    setSyncing(false);
  };

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
          <p className="text-sm text-gray-500 mt-1">FPS {ownFps} · {t("otherShops.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchFromPortal} disabled={syncing || officeCodes.length === 0}
            className="btn-secondary text-sm disabled:opacity-50"
            title={t("otherShops.fetchHint", { codes: officeCodes.join(", ") })}>
            {syncing ? `⏳ ${t("otherShops.fetching")}` : `🔄 ${t("otherShops.fetchFromPortal")}`}
          </button>
          {!readOnly && (
            <button onClick={() => setEditing("")} className="btn-primary text-sm">+ {t("otherShops.addShop")}</button>
          )}
        </div>
      </div>

      {syncLines.length > 0 && (
        <ul className="card px-5 py-3 space-y-1 text-xs font-mono">
          {syncLines.map((l) => (
            <li key={l.code} className={l.ok ? "text-emerald-700" : "text-red-700"}>{l.ok ? "✅" : "❌"} {l.text}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.shopsSeen")}</div>
          <div className="text-[28px] font-semibold font-mono">{formatNumber(rows.filter((r) => r.transactions > 0).length)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.inPortal")}</div>
          <div className="text-[28px] font-semibold font-mono text-blue-700">{formatNumber(rows.length - notInPortal)}</div>
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

      {notInPortal > 0 && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">ℹ️ {t("otherShops.notInPortalHint", { count: notInPortal })}</p>
      )}

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
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.owner")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.shopName")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.mobile")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("otherShops.office")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("otherShops.totalCards")}</th>
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
                      {r.ownerName || <span className="text-gray-400">{r.inPortal ? "—" : t("otherShops.notFetched")}</span>}
                      {r.dealerName && r.dealerName !== r.ownerName && <div className="text-gray-500">{r.dealerName}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {r.shopName || <span className="text-gray-400">—</span>}
                      {r.address && <div className="text-gray-500 mt-0.5">{r.address}</div>}
                      {r.notes && <div className="text-gray-400 mt-0.5">{r.notes}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {[r.mobile, r.altMobile].filter(Boolean).map((m) => (
                        <a key={m} href={`tel:${m}`} className="block text-blue-600 hover:underline font-mono">{m}</a>
                      ))}
                      {!r.mobile && !r.altMobile && (
                        <span className="font-mono text-gray-400" title={t("otherShops.maskedHint")}>{r.mobileMasked || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.office || "—"}
                      {r.mapUrl && (
                        <a href={r.mapUrl} target="_blank" rel="noopener noreferrer"
                          className="block text-blue-600 hover:underline">📍 {t("otherShops.openMap")}</a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{r.totalCards === null ? "—" : formatNumber(r.totalCards)}</td>
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { useOtherShops } from "@/store/useOtherShops";
import { ShopDialog } from "@/components/otherShops/ShopDialog";
import { ShopCard, type ShopCardData } from "@/components/otherShops/ShopCard";
import { apiFetch } from "@/lib/apiFetch";
import { homeFpsOf } from "@/lib/otherShops";
import { relevantShopIds } from "@/lib/shopCards";
import { myCustomers } from "@/lib/familySummary";
import { masterCountsBySource } from "@/lib/fpsSummary";
import type { BeneficiaryImport } from "@/types";
import { EmptyState } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";


const officeCodeOf = (fps: string) => fps.slice(0, 7);

export default function OtherShopsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { settings, viewingDealer, transactions, customers } = useStore();
  const {
    shops, seen, directory, profiles, loading, error, readOnly, syncOffice, reloadDirectory, loadProfiles, saveProfiles,
  } = useOtherShops();
  const [imports, setImports] = useState<BeneficiaryImport[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadLine, setUploadLine] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncLines, setSyncLines] = useState<{ code: string; ok: boolean; text: string }[]>([]);
  const aggregateMode = session?.role === "admin" && !viewingDealer;
  const ownFps = viewingDealer?.fpsId ?? settings.fpsId;

  const viewParam = viewingDealer ? `?viewFpsId=${encodeURIComponent(viewingDealer.fpsId)}` : "";
  const loadImports = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/customers/imports${viewParam}`);
      const data = await res.json();
      if (res.ok && data.success) setImports(data.imports);
    } catch {
      // Non-fatal — cards just show without the beneficiary summary.
    }
  }, [viewParam]);
  useEffect(() => { if (!aggregateMode) loadImports(); }, [aggregateMode, loadImports]);

  // Shops related to this dealer — the only ones a shop report is kept for.
  const relevant = useMemo(
    () => relevantShopIds({
      seen: seen.map((x) => x.shopFpsId),
      saved: shops.map((x) => x.shopFpsId),
      ownFps,
      importSources: imports.map((i) => i.sourceFpsId),
    }),
    [seen, shops, ownFps, imports]
  );
  const relevantKey = Array.from(relevant).sort().join(",");
  useEffect(() => {
    if (!aggregateMode && relevant.size > 0) loadProfiles(Array.from(relevant));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregateMode, relevantKey]);

  // This dealer's own shop: his customers (his latest government file's
  // cards, as on Customer Master) and his own cards' transactions
  // (portability "Self").
  const ownActivity = useMemo(() => {
    let txns = 0;
    let last = "";
    for (const tx of transactions) {
      if (homeFpsOf(tx)) continue;
      txns++;
      if (tx.date > last) last = tx.date;
    }
    return { families: myCustomers(customers, transactions, ownFps).length, transactions: txns, lastDate: last };
  }, [transactions, customers, ownFps]);

  // One card per shop: own shop first, then every other related shop.
  const cards = useMemo<ShopCardData[]>(() => {
    const savedMap = new Map(shops.map((x) => [x.shopFpsId, x]));
    const seenMap = new Map(seen.map((x) => [x.shopFpsId, x]));
    const uploadMap = new Map(imports.map((i) => [i.sourceFpsId, i]));
    const master = masterCountsBySource(customers, imports, ownFps);
    const others = Array.from(relevant)
      .filter((id) => id !== ownFps)
      .map((id) => {
        const sn = seenMap.get(id);
        return {
          fps: id, own: false,
          families: sn?.families ?? 0, transactions: sn?.transactions ?? 0, lastDate: sn?.lastDate ?? "",
          saved: savedMap.get(id), portal: directory.get(id), report: profiles.get(id),
          upload: uploadMap.get(id), master: master.get(id),
        };
      })
      .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.fps.localeCompare(b.fps));
    const own: ShopCardData = {
      fps: ownFps, own: true, ...ownActivity,
      portal: directory.get(ownFps), report: profiles.get(ownFps),
      upload: uploadMap.get(ownFps), master: master.get(ownFps),
    };
    return ownFps ? [own, ...others] : others;
  }, [relevant, ownFps, seen, shops, directory, profiles, imports, customers, ownActivity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [
        c.fps, c.saved?.shopName, c.saved?.dealerName, c.saved?.mobile, c.saved?.altMobile, c.saved?.address, c.saved?.notes,
        c.portal?.ownerName, c.portal?.afsoName, c.report?.dealerName, c.report?.mobile, c.report?.village, c.report?.licenseNo,
        c.upload?.sourceFpsName,
      ].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [cards, query]);

  const otherCards = cards.filter((c) => !c.own);
  const unsaved = otherCards.filter((c) => !c.saved).length;
  const notInPortal = otherCards.filter((c) => !c.portal).length;
  const withReport = cards.filter((c) => c.report).length;

  // The portal lists shops per AFSO office (first 7 digits of the FPS number):
  // fetch the dealer's own office plus every office an other shop belongs to.
  const officeCodes = useMemo(() => {
    const set = new Set<string>();
    if (/^\d{12}$/.test(ownFps)) set.add(officeCodeOf(ownFps));
    for (const c of cards) if (/^\d{7,}$/.test(c.fps)) set.add(officeCodeOf(c.fps));
    return Array.from(set).sort();
  }, [cards, ownFps]);

  // A government "FPS Wise Scheme Wise UID Count" report: keep only the
  // shops related to this dealer.
  const uploadReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || readOnly) return;
    setUploading(true);
    setUploadLine(null);
    try {
      const XLSX = await import("xlsx");
      const { isShopReport, parseShopReport } = await import("@/lib/shopReport");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      if (!isShopReport(wb)) throw new Error(t("otherShops.notShopReport"));
      const { meta, shops: all } = parseShopReport(wb);
      if (!meta) throw new Error(t("otherShops.notShopReport"));
      const mine = all.filter((x) => relevant.has(x.shopFpsId));
      const r = mine.length > 0 ? await saveProfiles(mine) : { saved: 0, skippedOlder: 0 };
      await loadProfiles(Array.from(relevant), true);
      setUploadLine({
        ok: true,
        text: t("otherShops.reportSaved", {
          tfso: meta.tfso || file.name, date: meta.updatedOn, saved: r.saved, total: all.length,
          unrelated: all.length - mine.length, older: r.skippedOlder,
        }),
      });
    } catch (err) {
      setUploadLine({ ok: false, text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
            <label className={`btn-secondary text-sm cursor-pointer ${uploading ? "opacity-50" : ""}`}
              title={t("otherShops.uploadReportHint")}>
              {uploading ? `⏳ ${t("otherShops.uploading")}` : `📄 ${t("otherShops.uploadReport")}`}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={uploadReport} disabled={uploading} />
            </label>
          )}
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

      {uploadLine && (
        <div className={`px-4 py-3 rounded-lg text-sm ${uploadLine.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {uploadLine.ok ? "✅" : "❌"} {uploadLine.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.shopsSeen")}</div>
          <div className="text-[28px] font-semibold font-mono">{formatNumber(otherCards.filter((c) => c.transactions > 0).length)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.inPortal")}</div>
          <div className="text-[28px] font-semibold font-mono text-blue-700">{formatNumber(otherCards.length - notInPortal)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.detailsSaved")}</div>
          <div className="text-[28px] font-semibold font-mono text-emerald-700">{formatNumber(otherCards.length - unsaved)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.detailsMissing")}</div>
          <div className="text-[28px] font-semibold font-mono text-amber-600">{formatNumber(unsaved)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-gray-500">{t("otherShops.withReport")}</div>
          <div className="text-[28px] font-semibold font-mono text-violet-700">{formatNumber(withReport)}</div>
        </div>
      </div>

      {notInPortal > 0 && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">ℹ️ {t("otherShops.notInPortalHint", { count: notInPortal })}</p>
      )}

      <div className="card p-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("otherShops.search")}
          className="input-field text-sm mb-4 max-w-md" />
        {error && <div className="mb-3 text-xs text-red-600">{error}</div>}
        {loading && cards.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">{t("otherShops.noShops")}</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <ShopCard key={c.fps} d={c} readOnly={readOnly} onEdit={c.own ? undefined : () => setEditing(c.fps)} />
            ))}
          </div>
        )}
      </div>

      {editing !== null && <ShopDialog shopFpsId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

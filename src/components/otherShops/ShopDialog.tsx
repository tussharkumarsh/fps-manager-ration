"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOtherShops, type OtherShopDetails } from "@/store/useOtherShops";
import { useStore } from "@/store/useStore";
import { cn, formatNumber } from "@/lib/utils";
import { shopDisplayName } from "@/lib/otherShops";

const EMPTY: OtherShopDetails = { shopName: "", dealerName: "", mobile: "", altMobile: "", address: "", notes: "" };

/**
 * Add / edit / delete the saved details of another shop. `shopFpsId` = ""
 * opens it blank for a shop typed in by hand.
 */
export function ShopDialog({ shopFpsId, onClose }: { shopFpsId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { byFps, directory, profiles, save, remove, readOnly } = useOtherShops();
  const ownFps = useStore((s) => s.settings.fpsId);
  const existing = shopFpsId ? byFps.get(shopFpsId) : undefined;
  const portal = directory.get(shopFpsId || "");
  const report = profiles.get(shopFpsId || "");
  const [fps, setFps] = useState(shopFpsId);
  const [form, setForm] = useState<OtherShopDetails>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFps(shopFpsId);
    // Blank fields are pre-filled from the government shop report (then the
    // portal); anything the dealer saved is kept as is.
    const reportAddress = report ? [report.village, report.tehsil].filter(Boolean).join(", ") : "";
    setForm(existing ? {
      shopName: existing.shopName, dealerName: existing.dealerName || report?.dealerName || "",
      mobile: existing.mobile || report?.mobile || "",
      altMobile: existing.altMobile, address: existing.address || reportAddress, notes: existing.notes,
    } : {
      ...EMPTY,
      dealerName: report?.dealerName || portal?.ownerName || "",
      mobile: report?.mobile || "",
      address: reportAddress,
    });
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopFpsId, existing?.updatedAt]);

  const set = (k: keyof OtherShopDetails) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    const id = fps.trim();
    if (!/^\d{6,20}$/.test(id)) return setError(t("otherShops.invalidFps"));
    if (id === ownFps) return setError(t("otherShops.ownFps"));
    setBusy(true);
    setError("");
    try {
      await save(id, form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!existing || !confirm(t("otherShops.confirmDelete", { fps: existing.shopFpsId }))) return;
    setBusy(true);
    try {
      await remove(existing.shopFpsId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof OtherShopDetails, label: string, opts: { type?: string; wide?: boolean; area?: boolean } = {}) => (
    <label className={cn("block", opts.wide && "sm:col-span-2")}>
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {opts.area ? (
        <textarea value={form[k]} onChange={set(k)} disabled={readOnly} rows={2} className="input-field mt-1 text-sm" />
      ) : (
        <input value={form[k]} onChange={set(k)} disabled={readOnly} type={opts.type || "text"} className="input-field mt-1 text-sm" />
      )}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-apple-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="text-base font-semibold mb-4">
          🏪 {existing || shopFpsId ? t("otherShops.editShop") : t("otherShops.addShop")}
        </h3>
        {portal && (
          <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-xs">
            <div className="font-semibold text-gray-500 mb-1">{t("otherShops.fromPortal")}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-gray-400">{t("otherShops.owner")}</dt><dd className="font-medium text-gray-800">{portal.ownerName || "—"}</dd>
              <dt className="text-gray-400">{t("otherShops.office")}</dt><dd>{[portal.afsoName, portal.distName].filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-gray-400">{t("otherShops.mobile")}</dt><dd className="font-mono">{portal.mobileMasked || "—"}</dd>
              <dt className="text-gray-400">{t("otherShops.terminal")}</dt><dd className="font-mono">{portal.terminalId || "—"}</dd>
              <dt className="text-gray-400">{t("otherShops.totalCards")}</dt><dd className="font-mono">{formatNumber(portal.totalCards)}</dd>
              {portal.latitude !== null && portal.longitude !== null && (
                <>
                  <dt className="text-gray-400">{t("otherShops.location")}</dt>
                  <dd>
                    <a href={`https://www.google.com/maps?q=${portal.latitude},${portal.longitude}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:underline">📍 {t("otherShops.openMap")}</a>
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">{t("otherShops.fpsNo")}</span>
            <input value={fps} onChange={(e) => setFps(e.target.value.replace(/\D/g, ""))} disabled={!!shopFpsId || readOnly}
              inputMode="numeric" placeholder="151209500218" className="input-field mt-1 text-sm font-mono" />
          </label>
          {field("shopName", t("otherShops.shopName"), { wide: true })}
          {field("dealerName", t("otherShops.dealerName"))}
          {field("mobile", t("otherShops.mobile"), { type: "tel" })}
          {field("altMobile", t("otherShops.altMobile"), { type: "tel" })}
          <div className="hidden sm:block" />
          {field("address", t("otherShops.address"), { wide: true, area: true })}
          {field("notes", t("otherShops.notes"), { wide: true, area: true })}
        </div>
        {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
        {readOnly && <div className="mt-3 text-xs text-gray-500">{t("otherShops.readOnly")}</div>}
        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {existing && !readOnly && (
              <button onClick={del} disabled={busy} className="text-xs text-red-600 hover:underline">
                🗑️ {t("otherShops.delete")}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">{t("otherShops.cancel")}</button>
            {!readOnly && (
              <button onClick={submit} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                {busy ? "…" : t("otherShops.save")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * An other-shop FPS number with its saved name. Clicking it opens the
 * details (to add them when nothing is saved yet).
 */
export function ShopTag({ fps, className }: { fps: string; className?: string }) {
  const { t } = useTranslation();
  const { byFps, directory } = useOtherShops();
  const [open, setOpen] = useState(false);
  if (!fps) return <span className={className}>{t("otherShops.unknownShop")}</span>;
  const shop = byFps.get(fps);
  const portal = directory.get(fps);
  const name = shopDisplayName(fps, byFps, directory);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={[shop?.dealerName || portal?.ownerName, shop?.mobile || portal?.mobileMasked, portal?.afsoName].filter(Boolean).join(" · ") || t("otherShops.addDetails")}
        className={cn("text-left hover:underline", className)}>
        <span className="font-mono">{fps}</span>
        {name
          ? <span className="font-medium"> · {name}</span>
          : <span className="text-gray-400"> · {t("otherShops.addDetails")}</span>}
      </button>
      {open && <ShopDialog shopFpsId={fps} onClose={() => setOpen(false)} />}
    </>
  );
}

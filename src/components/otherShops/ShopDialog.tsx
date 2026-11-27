"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOtherShops, type OtherShopDetails } from "@/store/useOtherShops";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

const EMPTY: OtherShopDetails = { shopName: "", dealerName: "", mobile: "", altMobile: "", address: "", notes: "" };

/**
 * Add / edit / delete the saved details of another shop. `shopFpsId` = ""
 * opens it blank for a shop typed in by hand.
 */
export function ShopDialog({ shopFpsId, onClose }: { shopFpsId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { byFps, save, remove, readOnly } = useOtherShops();
  const ownFps = useStore((s) => s.settings.fpsId);
  const existing = shopFpsId ? byFps.get(shopFpsId) : undefined;
  const [fps, setFps] = useState(shopFpsId);
  const [form, setForm] = useState<OtherShopDetails>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFps(shopFpsId);
    setForm(existing ? {
      shopName: existing.shopName, dealerName: existing.dealerName, mobile: existing.mobile,
      altMobile: existing.altMobile, address: existing.address, notes: existing.notes,
    } : EMPTY);
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
  const { byFps } = useOtherShops();
  const [open, setOpen] = useState(false);
  if (!fps) return <span className={className}>{t("otherShops.unknownShop")}</span>;
  const shop = byFps.get(fps);
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={shop ? [shop.dealerName, shop.mobile].filter(Boolean).join(" · ") || shop.shopName : t("otherShops.addDetails")}
        className={cn("text-left hover:underline", className)}>
        <span className="font-mono">{fps}</span>
        {shop?.shopName
          ? <span className="font-medium"> · {shop.shopName}</span>
          : <span className="text-gray-400"> · {t("otherShops.addDetails")}</span>}
      </button>
      {open && <ShopDialog shopFpsId={fps} onClose={() => setOpen(false)} />}
    </>
  );
}

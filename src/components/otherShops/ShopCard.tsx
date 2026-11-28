"use client";

import type { ReactNode } from "react";
import { cn, formatDate, formatNumber, dateOnly } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { callMobile } from "@/lib/shopCards";
import type { BeneficiaryImport, FpsDirectoryEntry, OtherShop, ShopProfile } from "@/types";

export interface ShopCardData {
  fps: string;
  own: boolean;
  families: number;
  transactions: number;
  lastDate: string;
  saved?: OtherShop;
  portal?: FpsDirectoryEntry;
  report?: ShopProfile;
  upload?: BeneficiaryImport;
  /** Master vs the latest beneficiary file of this shop. */
  master?: { inMaster: number; notInLatest: number };
}

const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatNumber(v));

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="pt-3 mt-3 border-t border-gray-100">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</span>
        {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="font-mono text-[13px] font-semibold text-gray-800 break-words">{children}</div>
    </div>
  );
}

/**
 * Everything known about one shop: the dealer's saved contact, the
 * government shop report, the portal directory, the latest beneficiary file
 * and this dealer's own activity with the shop's cards.
 */
export function ShopCard({ d, onEdit, readOnly }: { d: ShopCardData; onEdit?: () => void; readOnly: boolean }) {
  const { t } = useTranslation();
  const { saved, portal, report, upload } = d;
  const name = saved?.shopName || report?.dealerName || upload?.sourceFpsName || portal?.ownerName || "";
  const person = saved?.dealerName || (report?.dealerName !== name ? report?.dealerName : "") || "";
  const call = callMobile({ saved: saved?.mobile, report: report?.mobile, masked: portal?.mobileMasked });
  const place = [report?.village, report?.tehsil].filter(Boolean).join(", ") || [portal?.afsoName, portal?.distName].filter(Boolean).join(", ");
  const mapUrl = portal && portal.latitude !== null && portal.longitude !== null
    ? `https://www.google.com/maps?q=${portal.latitude},${portal.longitude}` : "";
  const f = upload?.footer;

  return (
    <div className={cn("card p-4", d.own && "ring-2 ring-blue-300 bg-blue-50/30")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 break-words">
            🏪 {name || <span className="text-gray-400">{t("otherShops.notFetched")}</span>}
            {d.own && (
              <span className="ml-2 align-middle rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                {t("otherShops.yourShop")}
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-gray-500">{d.fps}</div>
          {person && <div className="text-xs text-gray-600">{person}</div>}
        </div>
        {!d.own && onEdit && (
          <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">
            {readOnly ? t("otherShops.view") : saved ? t("otherShops.edit") : t("otherShops.addDetails")}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {call.number && (
          call.masked
            ? <span className="font-mono text-gray-400" title={t("otherShops.maskedHint")}>📞 {call.number}</span>
            : <a href={`tel:${call.number}`} className="font-mono text-blue-600 hover:underline">📞 {call.number}</a>
        )}
        {saved?.altMobile && <a href={`tel:${saved.altMobile}`} className="font-mono text-blue-600 hover:underline">📞 {saved.altMobile}</a>}
        {place && <span>📍 {place}</span>}
        {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t("otherShops.openMap")}</a>}
        {report?.licenseNo && <span>{t("otherShops.license")}: <b className="font-mono">{report.licenseNo}</b></span>}
        {report?.shopType && <span>{t("otherShops.shopType")}: <b>{report.shopType}</b></span>}
        {report?.shopNo && <span>{t("otherShops.shopNo")}: {report.shopNo}</span>}
      </div>
      {(saved?.address || saved?.notes) && (
        <div className="mt-1 text-xs text-gray-500">
          {saved.address && <div>{saved.address}</div>}
          {saved.notes && <div className="text-gray-400">{saved.notes}</div>}
        </div>
      )}

      <Section title={t("otherShops.govReport")} sub={report ? `${t("otherShops.asOf")} ${report.reportUpdatedOn}` : undefined}>
        {report ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={t("otherShops.cards")}>
              {n(report.counts.total.rcs)}
              <span className="block text-[11px] font-normal text-gray-500">AAY {n(report.counts.aay.rcs)} · PHH {n(report.counts.phh.rcs)}</span>
            </Stat>
            <Stat label={t("otherShops.units")}>
              {n(report.counts.total.units)}
              <span className="block text-[11px] font-normal text-gray-500">AAY {n(report.counts.aay.units)} · PHH {n(report.counts.phh.units)}</span>
            </Stat>
            <Stat label="*M1ANARC">{n(report.counts.total.m1anarc)}</Stat>
            <Stat label="*ANAM">{n(report.counts.total.anam)}</Stat>
          </div>
        ) : (
          <div className="text-xs text-gray-400">{t("otherShops.noReport")}</div>
        )}
      </Section>

      <Section title={t("otherShops.beneficiaryFile")} sub={upload ? `${t("otherShops.uploaded")} ${stamp(upload.importedAt)}` : undefined}>
        {upload && f ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t("otherShops.cards")}>
                {n(f.totalCards ?? upload.cards)}
                <span className="block text-[11px] font-normal text-gray-500">AAY {n(upload.aayCards)} · PHH {n(upload.phhCards)}</span>
              </Stat>
              <Stat label={t("customers.hof")}>
                <span className="text-pink-700">F {n(f.femaleHof)}</span> · <span className="text-blue-700">M {n(f.maleHof)}</span>
              </Stat>
              <Stat label={t("customers.members")}>
                {n(f.totalMembers ?? upload.members)}
                <span className="block text-[11px] font-normal text-gray-500">F {n(f.female)} · M {n(f.male)}</span>
              </Stat>
              <Stat label="UID">
                <span className="text-emerald-700">{n(f.validUid)}</span>
                <span className="block text-[11px] font-normal text-gray-500">{t("customers.invalid")} {n(f.invalidUid)}</span>
              </Stat>
              <Stat label={t("customers.mobile")}>
                <span className="text-emerald-700">{n(f.validMobile)}</span>
                <span className="block text-[11px] font-normal text-gray-500">{t("customers.invalid")} {n(f.invalidMobile)}</span>
              </Stat>
              <Stat label={t("customers.ageGroups")}>
                <span className="block text-[11px] font-normal text-gray-600">0–5: {n(f.age0to5)} · 5–12: {n(f.age5to12)}</span>
                <span className="block text-[11px] font-normal text-gray-600">12–60: {n(f.age12to60)} · 60+: {n(f.age60plus)}</span>
              </Stat>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              {t("customers.inMaster")} <b>{n(d.master?.inMaster ?? 0)}</b>
              {" · "}{t("customers.newThisUpload")} <b className="text-emerald-700">{n(upload.newCards)}</b>
              {" · "}{t("customers.updatedThisUpload")} <b>{n(upload.updatedCards)}</b>
              {" · "}{t("customers.notInLatestFile")} <b className="text-amber-700">{n(d.master?.notInLatest ?? 0)}</b>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400">{t("otherShops.noBeneficiaryFile")}</div>
        )}
      </Section>

      <Section title={d.own ? t("otherShops.ownActivity") : t("otherShops.activity")}>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
          <span>{t("otherShops.families")}: <b className="font-mono">{n(d.families)}</b></span>
          <span>{t("otherShops.transactions")}: <b className="font-mono">{n(d.transactions)}</b></span>
          <span>{t("otherShops.lastSeen")}: <b className="font-mono">{d.lastDate ? formatDate(dateOnly(d.lastDate)) : "—"}</b></span>
          {portal && <span>{t("otherShops.portalCards")}: <b className="font-mono">{n(portal.totalCards)}</b></span>}
        </div>
      </Section>
    </div>
  );
}

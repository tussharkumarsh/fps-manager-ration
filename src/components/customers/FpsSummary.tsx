"use client";

import { useMemo, type ReactNode } from "react";
import { cn, formatNumber } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { masterCountsBySource, orderSummaries } from "@/lib/fpsSummary";
import type { BeneficiaryImport, Customer } from "@/types";

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : formatNumber(n);
}

function updatedLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
 * The footer summary of each uploaded government beneficiary file, one card
 * per source FPS (latest upload), with how the master compares to it. The
 * dealer's own FPS comes first.
 */
export function FpsSummary({
  imports, customers, ownFpsId,
}: {
  imports: BeneficiaryImport[];
  customers: Customer[];
  ownFpsId: string;
}) {
  const { t } = useTranslation();
  const ordered = useMemo(() => orderSummaries(imports, ownFpsId), [imports, ownFpsId]);
  const counts = useMemo(() => masterCountsBySource(customers, imports, ownFpsId), [customers, imports, ownFpsId]);

  if (ordered.length === 0) {
    return (
      <div className="card p-4 text-xs text-gray-500">
        📄 {t("customers.fpsSummaryEmpty")}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold">📄 {t("customers.fpsSummaryTitle")}</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">{t("customers.fpsSummarySub")}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ordered.map((imp) => {
          const own = imp.sourceFpsId === ownFpsId;
          const f = imp.footer;
          const c = counts.get(imp.sourceFpsId);
          return (
            <div key={imp.sourceFpsId}
              className={cn("rounded-xl border p-4", own ? "border-blue-300 bg-blue-50/40" : "border-gray-200")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 break-words">
                    {imp.sourceFpsName || "—"}
                    {own && (
                      <span className="ml-2 align-middle rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        {t("customers.ownFps")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{imp.sourceFpsId}</div>
                  {imp.tfso && <div className="text-[11px] text-gray-400">{imp.tfso}</div>}
                </div>
                <div className="text-right text-[11px] text-gray-500">
                  {t("customers.updatedOn")}
                  <div className="font-medium text-gray-700">{updatedLabel(imp.importedAt)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label={t("customers.totalCards")}>
                  {fmt(f.totalCards ?? imp.cards)}
                  <span className="block text-[11px] font-normal text-gray-500">AAY {fmt(imp.aayCards)} · PHH {fmt(imp.phhCards)}</span>
                </Stat>
                <Stat label={t("customers.hof")}>
                  <span className="text-pink-700">F {fmt(f.femaleHof)}</span> · <span className="text-blue-700">M {fmt(f.maleHof)}</span>
                </Stat>
                <Stat label={t("customers.members")}>
                  {fmt(f.totalMembers ?? imp.members)}
                  <span className="block text-[11px] font-normal text-gray-500">F {fmt(f.female)} · M {fmt(f.male)}</span>
                </Stat>
                <Stat label="UID">
                  <span className="text-emerald-700">{fmt(f.validUid)}</span>
                  <span className="block text-[11px] font-normal text-gray-500">{t("customers.invalid")} {fmt(f.invalidUid)}</span>
                </Stat>
                <Stat label={t("customers.mobile")}>
                  <span className="text-emerald-700">{fmt(f.validMobile)}</span>
                  <span className="block text-[11px] font-normal text-gray-500">{t("customers.invalid")} {fmt(f.invalidMobile)}</span>
                </Stat>
                <Stat label={t("customers.ageGroups")}>
                  <span className="block text-[11px] font-normal text-gray-600">0–5: {fmt(f.age0to5)} · 5–12: {fmt(f.age5to12)}</span>
                  <span className="block text-[11px] font-normal text-gray-600">12–60: {fmt(f.age12to60)} · 60+: {fmt(f.age60plus)}</span>
                </Stat>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                {t("customers.inMaster")} <b>{fmt(c?.inMaster ?? 0)}</b>
                {" · "}{t("customers.newThisUpload")} <b className="text-emerald-700">{fmt(imp.newCards)}</b>
                {" · "}{t("customers.updatedThisUpload")} <b>{fmt(imp.updatedCards)}</b>
                {" · "}{t("customers.notInLatestFile")} <b className="text-amber-700">{fmt(c?.notInLatest ?? 0)}</b>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

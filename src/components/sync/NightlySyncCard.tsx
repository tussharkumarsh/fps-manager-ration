"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { getMonthName } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SyncRun } from "@/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * The nightly auto-sync (23:00 IST, Vercel Cron) and how its recent jobs
 * ended: one line per job (transactions per month, SCM allotment).
 */
export function NightlySyncCard({ viewFpsId }: { viewFpsId?: string }) {
  const { t } = useTranslation();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);

  useEffect(() => {
    const view = viewFpsId ? `?viewFpsId=${encodeURIComponent(viewFpsId)}` : "";
    apiFetch(`/api/sync-runs${view}`)
      .then((r) => r.json())
      .then((d) => setRuns(d.success ? d.runs : []))
      .catch(() => setRuns([]));
  }, [viewFpsId]);

  // The latest night only: jobs started within an hour of the newest one.
  const latest = runs && runs.length > 0 ? Date.parse(runs[0].startedAt) : 0;
  const lastNight = (runs ?? []).filter((r) => latest - Date.parse(r.startedAt) < 3600_000);

  return (
    <div className="card p-5 max-w-5xl">
      <h3 className="text-sm font-semibold">🌙 {t("sync.nightlyTitle")}</h3>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{t("sync.nightlySub")}</p>
      {runs === null ? (
        <div className="text-xs text-gray-400">…</div>
      ) : lastNight.length === 0 ? (
        <div className="text-xs text-gray-500">{t("sync.nightlyNone")}</div>
      ) : (
        <ul className="space-y-1 text-xs">
          {lastNight.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2">
              <span>{r.ok === true ? "✅" : r.ok === false ? "❌" : "⏳"}</span>
              <span className="font-medium text-gray-800">
                {r.job === "scm" ? t("sync.nightlyScm") : t("sync.nightlyTransactions")} · {getMonthName(Number(r.month))} {r.year}
              </span>
              <span className="text-gray-400">{when(r.startedAt)}</span>
              <span className={r.ok === false ? "text-red-600" : "text-gray-600"}>
                {r.ok === null ? t("sync.nightlyUnfinished") : r.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";

export interface AutoLoadInfo {
  loading: boolean;
  source?: "gov_api" | "sheet_cache";
  lockStatus?: "live" | "synced_locked";
  count?: number;
  error?: string;
}

/**
 * On login (and whenever month/year changes), loads that month's data for
 * the signed-in user purely from the stored database — this never calls
 * the government API. The gov API is only ever hit by an explicit manual
 * "Fetch and Parse" on the Sync page; every login/navigation/page remount
 * after that just reads back what's already stored, so viewing data never
 * triggers a fresh gov-API call. Merges the result into the local store so
 * pages display it without requiring a manual sync each time.
 */
export function useAutoLoadMonth(month: string, year: string): AutoLoadInfo {
  const { status, data: session } = useSession();
  const addTransactions = useStore((s) => s.addTransactions);
  const viewingFpsId = useStore((s) => s.viewingDealer?.fpsId);
  const [info, setInfo] = useState<AutoLoadInfo>({ loading: false });
  const lastKey = useRef<string>("");

  // An admin with no specific dealer selected is looking at the collective
  // view across every dealer — useLoadAllHistory already fetched everything
  // stored for every dealer, across all months, so there's no single
  // "current month" to sync here.
  const isAdminAggregateView = session?.role === "admin" && !viewingFpsId;

  useEffect(() => {
    if (status !== "authenticated" || !session?.fpsId || isAdminAggregateView) return;
    // Idempotent — see useLoadAllHistory. Called here too since this hook's
    // effect can run before useLoadAllHistory's (child effects run before
    // parent effects), and this fetch merges into the store rather than
    // replacing it, so it must never merge onto another account's data.
    useStore.getState().syncSessionIdentity(`${session.role}:${session.fpsId}`);

    const key = `${useStore.getState().sessionEpoch}:${viewingFpsId || "self"}-${year}-${month}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    let cancelled = false;
    setInfo((prev) => ({ ...prev, loading: true, error: undefined }));

    const viewParam = viewingFpsId ? `&viewFpsId=${encodeURIComponent(viewingFpsId)}` : "";
    apiFetch(`/api/transactions?month=${month}&year=${year}${viewParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          addTransactions(data.transactions);
          setInfo({
            loading: false,
            source: data.source,
            lockStatus: data.lockStatus,
            count: data.count,
          });
        } else {
          setInfo({ loading: false, error: data.error || "Failed to load" });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setInfo({ loading: false, error: err instanceof Error ? err.message : "Failed to load" });
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.fpsId, session?.role, month, year, viewingFpsId, isAdminAggregateView, addTransactions]);

  return info;
}

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
 * the signed-in user: reads from the server, which itself reads from the
 * stored database if that month is already locked, or fetches once from
 * the gov API and stores it if not. Merges the result into the local store
 * so pages display it without requiring a manual "Sync" click.
 *
 * The current (live) month is a special case: its data can change during
 * the day on the gov server, so it's worth a fresh fetch — but only once
 * per login, not on every month/year navigation or page remount. A
 * sessionStorage flag (cleared on next login/tab close) tracks whether
 * this account has already done that one live fetch this session; every
 * other request for the current month asks the server to serve its cache
 * instead of hitting the gov API again.
 */
function hasSyncedThisLogin(identity: string): boolean {
  try {
    return sessionStorage.getItem(`freshSync:${identity}`) === "1";
  } catch {
    return true; // if sessionStorage is unavailable, don't force extra gov-API calls
  }
}

function markSyncedThisLogin(identity: string): void {
  try {
    sessionStorage.setItem(`freshSync:${identity}`, "1");
  } catch {
    // ignore
  }
}
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

    const identity = `${session.role}:${session.fpsId}`;
    const viewParam = viewingFpsId ? `&viewFpsId=${encodeURIComponent(viewingFpsId)}` : "";
    const forceParam = !viewingFpsId && !hasSyncedThisLogin(identity) ? "&forceRefresh=true" : "";
    apiFetch(`/api/transactions?month=${month}&year=${year}${viewParam}${forceParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          if (forceParam) markSyncedThisLogin(identity);
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

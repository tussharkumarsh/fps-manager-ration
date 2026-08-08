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
 * stored Excel sheet if that month is already locked, or fetches once from
 * the gov API and stores it if not. Merges the result into the local store
 * so pages display it without requiring a manual "Sync" click.
 */
export function useAutoLoadMonth(month: string, year: string): AutoLoadInfo {
  const { status } = useSession();
  const addTransactions = useStore((s) => s.addTransactions);
  const [info, setInfo] = useState<AutoLoadInfo>({ loading: false });
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (status !== "authenticated") return;
    const key = `${year}-${month}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    let cancelled = false;
    setInfo((prev) => ({ ...prev, loading: true, error: undefined }));

    apiFetch(`/api/transactions?month=${month}&year=${year}`)
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
  }, [status, month, year, addTransactions]);

  return info;
}

"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";

/**
 * On login (from any browser/device), loads every transaction already
 * synced for this user — a pure read from the stored Excel sheet, never
 * calls the gov API. Runs once per authenticated session so previously
 * fetched months (e.g. Jan-Aug) show up immediately without needing to
 * re-select and re-fetch each month one by one.
 */
export function useLoadAllHistory(): void {
  const { status } = useSession();
  const addTransactions = useStore((s) => s.addTransactions);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || loadedRef.current) return;
    loadedRef.current = true;

    apiFetch("/api/transactions/all")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) addTransactions(data.transactions);
      })
      .catch(() => {
        // Non-fatal — per-month auto-load on individual pages still works.
        loadedRef.current = false;
      });
  }, [status, addTransactions]);
}

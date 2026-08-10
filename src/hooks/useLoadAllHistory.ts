"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";

/**
 * On login (from any browser/device), loads every transaction already
 * synced and every customer already imported for this user — a pure read
 * from the stored Excel sheet, never calls the gov API. Runs once per
 * authenticated session.
 *
 * Customers are replaced wholesale (not merged) with the server's data:
 * the server is the source of truth, and a browser's locally-cached copy
 * can be stale (e.g. from before a parser bug fix was re-imported), so on
 * load the server's current data should always win.
 */
export function useLoadAllHistory(): void {
  const { status } = useSession();
  const addTransactions = useStore((s) => s.addTransactions);
  const setCustomers = useStore((s) => s.setCustomers);
  const viewingFpsId = useStore((s) => s.viewingDealer?.fpsId);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const key = viewingFpsId || "self";
    if (loadedRef.current === key) return;
    loadedRef.current = key;

    const suffix = viewingFpsId ? `?viewFpsId=${encodeURIComponent(viewingFpsId)}` : "";

    apiFetch(`/api/transactions/all${suffix}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) addTransactions(data.transactions);
      })
      .catch(() => {
        // Non-fatal — per-month auto-load on individual pages still works,
        // and allow a retry on the next mount.
        loadedRef.current = null;
      });

    apiFetch(`/api/customers${suffix}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCustomers(data.customers);
      })
      .catch(() => {
        // Non-fatal — the browser keeps whatever it already had cached.
      });
  }, [status, viewingFpsId, addTransactions, setCustomers]);
}

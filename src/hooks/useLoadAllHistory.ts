"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";

/**
 * On login (from any browser/device), loads every transaction already
 * synced and every customer already imported for this user — a pure read
 * from the stored database, never calls the gov API. Runs once per
 * authenticated session.
 *
 * Customers are replaced wholesale (not merged) with the server's data:
 * the server is the source of truth, and a browser's locally-cached copy
 * can be stale (e.g. from before a parser bug fix was re-imported), so on
 * load the server's current data should always win.
 *
 * The persisted store survives across logins in the same browser — if a
 * different account signs in, syncSessionIdentity wipes whatever's cached
 * from the previous one before this hook loads anything, so one dealer's
 * (or admin's collective) data can never bleed into another's session.
 */
export function useLoadAllHistory(): void {
  const { status, data: session } = useSession();
  const addTransactions = useStore((s) => s.addTransactions);
  const setCustomers = useStore((s) => s.setCustomers);
  const viewingDealer = useStore((s) => s.viewingDealer);
  const viewingFpsId = viewingDealer?.fpsId;
  const updateSettings = useStore((s) => s.updateSettings);
  const loadedRef = useRef<string | null>(null);

  // `settings.fpsId`/`distCode` are what every page's "FPS ..." header
  // displays — they must always reflect whichever account's data is
  // actually on screen (the dealer being viewed, or the signed-in
  // account itself), never a stale leftover value from a previous
  // session or an old default.
  useEffect(() => {
    if (status !== "authenticated" || !session?.fpsId) return;
    const effectiveFpsId = viewingDealer?.fpsId ?? session.fpsId;
    const effectiveDistCode = viewingDealer?.distCode ?? session.distCode;
    updateSettings({ fpsId: effectiveFpsId, distCode: effectiveDistCode });
  }, [status, session?.fpsId, session?.distCode, viewingDealer?.fpsId, viewingDealer?.distCode, updateSettings]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.fpsId) return;
    useStore.getState().syncSessionIdentity(`${session.role}:${session.fpsId}`);

    const key = `${useStore.getState().sessionEpoch}:${viewingFpsId || "self"}`;
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
  }, [status, session?.fpsId, session?.role, viewingFpsId, addTransactions, setCustomers]);
}

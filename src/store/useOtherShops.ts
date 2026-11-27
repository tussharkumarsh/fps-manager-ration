"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";
import { seenOtherShops, type SeenShop } from "@/lib/otherShops";
import type { Customer, FpsDirectoryEntry, OtherShop, Transaction } from "@/types";

export type OtherShopDetails = Omit<OtherShop, "fpsId" | "shopFpsId" | "updatedAt">;

interface OtherShopsState {
  shops: OtherShop[];
  /** Which account's book is loaded ("" = none yet). */
  loadedFor: string;
  loading: boolean;
  error: string;
  /** Portal directory entries loaded so far, by FPS number. */
  directory: Record<string, FpsDirectoryEntry>;
  /** The id set the directory was last loaded for. */
  directoryKey: string;
  load: (key: string, viewFpsId?: string) => Promise<void>;
  loadDirectory: (ids: string[], force?: boolean) => Promise<void>;
  save: (shopFpsId: string, details: OtherShopDetails) => Promise<OtherShop>;
  remove: (shopFpsId: string) => Promise<void>;
  syncOffice: (officeCode: string) => Promise<number>;
}

/**
 * The dealer's contact book of other shops, plus the portal's public
 * directory entries for them. Not persisted in the browser: it's small,
 * always read fresh from the server, and shared by every page that shows a
 * shop name (dashboard, transactions, reports, Other Shops).
 */
const useOtherShopsStore = create<OtherShopsState>((set, get) => ({
  shops: [],
  loadedFor: "",
  loading: false,
  error: "",
  directory: {},
  directoryKey: "",
  load: async (key, viewFpsId) => {
    if (get().loadedFor === key || get().loading) return;
    set({ loading: true, error: "" });
    try {
      const viewParam = viewFpsId ? `?viewFpsId=${encodeURIComponent(viewFpsId)}` : "";
      const res = await apiFetch(`/api/other-shops${viewParam}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to load shops");
      set({ shops: data.shops, loadedFor: key, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Failed to load shops" });
    }
  },
  loadDirectory: async (ids, force = false) => {
    const key = [...ids].sort().join(",");
    if (!key || (!force && get().directoryKey === key)) return;
    set({ directoryKey: key });
    try {
      const res = await apiFetch(`/api/other-shops/directory?ids=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok || !data.success) return;
      const add: Record<string, FpsDirectoryEntry> = {};
      for (const e of data.entries as FpsDirectoryEntry[]) add[e.shopFpsId] = e;
      set((s) => ({ directory: { ...s.directory, ...add } }));
    } catch {
      // Non-fatal — names just fall back to the FPS number.
      set({ directoryKey: "" });
    }
  },
  save: async (shopFpsId, details) => {
    const res = await apiFetch("/api/other-shops", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopFpsId, details }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to save");
    const shop = data.shop as OtherShop;
    set((s) => ({ shops: [...s.shops.filter((x) => x.shopFpsId !== shop.shopFpsId), shop] }));
    return shop;
  },
  remove: async (shopFpsId) => {
    const res = await apiFetch(`/api/other-shops?shopFpsId=${encodeURIComponent(shopFpsId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete");
    set((s) => ({ shops: s.shops.filter((x) => x.shopFpsId !== shopFpsId) }));
  },
  syncOffice: async (officeCode) => {
    const res = await apiFetch("/api/other-shops/directory/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officeCode }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch from portal");
    return data.count as number;
  },
}));

// seenOtherShops walks every transaction; many components use this hook at
// once, so it's computed once per transactions/customers snapshot.
let seenCache: { txns: Transaction[]; customers: Customer[]; seen: SeenShop[] } | null = null;
function seenShopsCached(txns: Transaction[], customers: Customer[]): SeenShop[] {
  if (!seenCache || seenCache.txns !== txns || seenCache.customers !== customers) {
    seenCache = { txns, customers, seen: seenOtherShops(txns, customers) };
  }
  return seenCache.seen;
}

/**
 * Loads (once per account) and returns the saved other-shop details and the
 * portal directory entries for every other shop seen in the transactions
 * or saved by hand — as lists and as maps keyed by FPS number.
 */
export function useOtherShops() {
  const { data: session, status } = useSession();
  const viewingFpsId = useStore((s) => s.viewingDealer?.fpsId);
  const transactions = useStore((s) => s.transactions);
  const customers = useStore((s) => s.customers);
  const state = useOtherShopsStore();
  const key = session?.fpsId ? `${session.role}:${session.fpsId}:${viewingFpsId || "self"}` : "";

  useEffect(() => {
    if (status === "authenticated" && key) state.load(key, viewingFpsId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, key]);

  // Another account's book may still be in memory until the new one loads.
  const shops = useMemo(() => (state.loadedFor === key ? state.shops : []), [state.loadedFor, state.shops, key]);
  const seen = seenShopsCached(transactions, customers);

  const ids = useMemo(() => {
    const set = new Set(seen.map((s) => s.shopFpsId));
    for (const s of shops) set.add(s.shopFpsId);
    return Array.from(set).sort();
  }, [seen, shops]);
  const idsKey = ids.join(",");

  useEffect(() => {
    if (status === "authenticated" && ids.length > 0) state.loadDirectory(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, idsKey]);

  const byFps = useMemo(() => new Map(shops.map((s) => [s.shopFpsId, s])), [shops]);
  const directory = useMemo(() => new Map(Object.entries(state.directory)), [state.directory]);

  return {
    shops,
    byFps,
    /** Portal directory entries, by FPS number. */
    directory,
    /** Other shops seen in the loaded transactions. */
    seen,
    loading: state.loading,
    error: state.error,
    readOnly: session?.role === "admin",
    save: state.save,
    remove: state.remove,
    syncOffice: state.syncOffice,
    /** Reloads the directory entries for every shop of interest (after a portal fetch). */
    reloadDirectory: () => state.loadDirectory(ids, true),
  };
}

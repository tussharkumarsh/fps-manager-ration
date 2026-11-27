"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { apiFetch } from "@/lib/apiFetch";
import type { OtherShop } from "@/types";

export type OtherShopDetails = Omit<OtherShop, "fpsId" | "shopFpsId" | "updatedAt">;

interface OtherShopsState {
  shops: OtherShop[];
  /** Which account's book is loaded ("" = none yet). */
  loadedFor: string;
  loading: boolean;
  error: string;
  load: (key: string, viewFpsId?: string) => Promise<void>;
  save: (shopFpsId: string, details: OtherShopDetails) => Promise<OtherShop>;
  remove: (shopFpsId: string) => Promise<void>;
}

/**
 * The dealer's contact book of other shops. Not persisted in the browser:
 * it's small, always read fresh from the server, and shared by every page
 * that shows a shop name (dashboard, transactions, reports, Other Shops).
 */
const useOtherShopsStore = create<OtherShopsState>((set, get) => ({
  shops: [],
  loadedFor: "",
  loading: false,
  error: "",
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
}));

/**
 * Loads (once per account) and returns the saved other-shop details, as a
 * list and as a map keyed by the shop's FPS number.
 */
export function useOtherShops() {
  const { data: session, status } = useSession();
  const viewingFpsId = useStore((s) => s.viewingDealer?.fpsId);
  const state = useOtherShopsStore();
  const key = session?.fpsId ? `${session.role}:${session.fpsId}:${viewingFpsId || "self"}` : "";

  useEffect(() => {
    if (status === "authenticated" && key) state.load(key, viewingFpsId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, key]);

  const byFps = useMemo(() => new Map(state.shops.map((s) => [s.shopFpsId, s])), [state.shops]);
  const readOnly = session?.role === "admin";
  // Another account's book may still be in memory until the new one loads.
  const shops = state.loadedFor === key ? state.shops : [];
  return {
    shops,
    byFps: state.loadedFor === key ? byFps : new Map<string, OtherShop>(),
    loading: state.loading,
    error: state.error,
    readOnly,
    save: state.save,
    remove: state.remove,
  };
}

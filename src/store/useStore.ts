"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Customer, Transaction, FPSSettings, SyncLog, InventoryItem, InventoryLedgerEntry } from "@/types";
import { deduplicateTransactions, generateId, isValidReceiptNo } from "@/lib/utils";

interface AppState {
  // Settings
  settings: FPSSettings;
  updateSettings: (settings: Partial<FPSSettings>) => void;

  // Customers
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (srcNo: string, data: Partial<Customer>) => void;
  deleteCustomer: (srcNo: string) => void;
  importCustomers: (customers: Customer[]) => void;

  // Transactions
  transactions: Transaction[];
  addTransactions: (txns: Transaction[]) => void;
  clearTransactions: () => void;

  // Sync logs
  syncLogs: SyncLog[];
  addSyncLog: (log: Omit<SyncLog, "id">) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Inventory
  inventoryItems: InventoryItem[];
  inventoryLedger: InventoryLedgerEntry[];
  setInventoryItems: (items: InventoryItem[]) => void;
  setInventoryLedger: (ledger: InventoryLedgerEntry[]) => void;
  addInventoryItem: (item: InventoryItem) => void;

  // Admin: viewing another dealer's data read-only
  viewingDealer: { fpsId: string; distCode: string; displayName: string } | null;
  setViewingDealer: (dealer: { fpsId: string; distCode: string; displayName: string }) => void;
  clearViewingDealer: () => void;

  // Identifies which logged-in account the cached data below belongs to
  // (`${role}:${fpsId}`) — see syncSessionIdentity.
  lastSessionKey: string | null;
  // Bumped every time syncSessionIdentity wipes the cache. Data-loading
  // hooks fold this into their "already loaded" cache key so an identity
  // switch always busts it — even if the new account happens to load the
  // same viewFpsId/month/year combination the previous one already had
  // marked as loaded.
  sessionEpoch: number;
  /**
   * Call on every render where a session is known. If the signed-in
   * account differs from whoever's data is currently cached (a different
   * user logged in on this same browser — the persisted store survives
   * across logins), wipes every per-account cache before anything reads
   * it, then records the new identity. Returns true when a wipe happened,
   * so callers know to force a fresh fetch.
   */
  syncSessionIdentity: (key: string) => boolean;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Settings
      settings: {
        distCode: "1512",
        fpsId: "151209500212",
        month: String(new Date().getMonth() + 1),
        year: String(new Date().getFullYear()),
        fpsName: "FPS Smart Management",
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Customers
      customers: [],
      setCustomers: (customers) => set({ customers }),
      addCustomer: (customer) =>
        set((state) => {
          const exists = state.customers.some((c) => c.srcNo === customer.srcNo);
          if (exists) return state;
          return { customers: [...state.customers, customer] };
        }),
      updateCustomer: (srcNo, data) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.srcNo === srcNo ? { ...c, ...data } : c
          ),
        })),
      deleteCustomer: (srcNo) =>
        set((state) => ({
          customers: state.customers.filter((c) => c.srcNo !== srcNo),
        })),
      importCustomers: (newCustomers) =>
        set((state) => {
          const existing = new Map(state.customers.map((c) => [c.srcNo, c]));
          newCustomers.forEach((c) => {
            existing.set(c.srcNo, { ...existing.get(c.srcNo), ...c });
          });
          return { customers: Array.from(existing.values()) };
        }),

      // Transactions
      transactions: [],
      addTransactions: (txns) =>
        set((state) => ({
          // Also drops any invalid entries already sitting in persisted
          // browser state from before this validation existed.
          transactions: deduplicateTransactions(
            state.transactions.filter((t) => isValidReceiptNo(t.receiptNo)),
            txns
          ),
        })),
      clearTransactions: () => set({ transactions: [] }),

      // Sync logs
      syncLogs: [],
      addSyncLog: (log) =>
        set((state) => ({
          syncLogs: [{ ...log, id: generateId() }, ...state.syncLogs].slice(0, 100),
        })),

      // UI
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Inventory
      inventoryItems: [],
      inventoryLedger: [],
      setInventoryItems: (inventoryItems) => set({ inventoryItems }),
      setInventoryLedger: (inventoryLedger) => set({ inventoryLedger }),
      addInventoryItem: (item) =>
        set((state) => ({ inventoryItems: [...state.inventoryItems, item] })),

      // Admin: viewing another dealer's data read-only. Switching (or
      // exiting) always clears locally cached data first — otherwise the
      // previous dealer's customers/transactions/inventory would briefly
      // (or permanently, if a fetch fails) show mixed with the new one's.
      viewingDealer: null,
      setViewingDealer: (dealer) =>
        set({
          viewingDealer: dealer,
          customers: [],
          transactions: [],
          inventoryItems: [],
          inventoryLedger: [],
        }),
      clearViewingDealer: () =>
        set({
          viewingDealer: null,
          customers: [],
          transactions: [],
          inventoryItems: [],
          inventoryLedger: [],
        }),

      lastSessionKey: null,
      sessionEpoch: 0,
      syncSessionIdentity: (key) => {
        if (get().lastSessionKey === key) return false;
        set((state) => ({
          lastSessionKey: key,
          sessionEpoch: state.sessionEpoch + 1,
          customers: [],
          transactions: [],
          syncLogs: [],
          inventoryItems: [],
          inventoryLedger: [],
          viewingDealer: null,
        }));
        return true;
      },
    }),
    {
      name: "fps-manager-storage",
      partialize: (state) => ({
        settings: state.settings,
        customers: state.customers,
        transactions: state.transactions,
        syncLogs: state.syncLogs,
        lastSessionKey: state.lastSessionKey,
      }),
    }
  )
);

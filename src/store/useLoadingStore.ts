"use client";

import { create } from "zustand";

interface LoadingState {
  activeRequests: number;
  start: () => void;
  stop: () => void;
}

/**
 * Global in-flight-request counter. Any network call (login, sync, customer
 * import, etc.) increments on start and decrements on finish — the global
 * loader (see GlobalLoader.tsx) shows whenever this is > 0, so every network
 * call gets a visible loading indicator without each call site needing its
 * own UI.
 */
export const useLoadingStore = create<LoadingState>((set) => ({
  activeRequests: 0,
  start: () => set((s) => ({ activeRequests: s.activeRequests + 1 })),
  stop: () => set((s) => ({ activeRequests: Math.max(0, s.activeRequests - 1) })),
}));

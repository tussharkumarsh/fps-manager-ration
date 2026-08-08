"use client";

import { useLoadingStore } from "@/store/useLoadingStore";
import { cn } from "@/lib/utils";

/**
 * Full-screen blocking overlay with a centered spinner, visible whenever any
 * network call (login, sync, customer import, auto-load) is in flight. The
 * overlay intercepts clicks (pointer-events-auto) so the page can't be
 * interacted with mid-request.
 */
export default function GlobalLoader() {
  const activeRequests = useLoadingStore((s) => s.activeRequests);
  const isLoading = activeRequests > 0;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[1px] transition-opacity duration-150",
        isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      role="status"
      aria-live="polite"
      aria-label={isLoading ? "Loading" : undefined}
    >
      {isLoading && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
          <span className="text-sm font-medium text-brand-700">Loading…</span>
        </div>
      )}
    </div>
  );
}

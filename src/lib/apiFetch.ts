import { useLoadingStore } from "@/store/useLoadingStore";

/**
 * Drop-in replacement for `fetch` that registers with the global loading
 * indicator for the duration of the request — use this for all client-side
 * network calls so every fetch shows a visible loader automatically.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { start, stop } = useLoadingStore.getState();
  start();
  try {
    return await fetch(input, init);
  } finally {
    stop();
  }
}

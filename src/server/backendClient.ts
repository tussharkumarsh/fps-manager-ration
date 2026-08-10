const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

export class BackendError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Calls the fps-manager-ration-backend service, which owns all Supabase
 * access. Only ever called from Next.js server-side code (API route
 * handlers) — never from the browser — since it carries the shared
 * INTERNAL_API_KEY that authorizes server-to-server access to dealer data.
 */
export async function backendFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string | undefined> }
): Promise<T> {
  const url = new URL(path, BACKEND_URL);
  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method: init?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": INTERNAL_API_KEY,
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new BackendError(data?.error || `Backend request failed with status ${res.status}`, res.status);
  }
  return data as T;
}

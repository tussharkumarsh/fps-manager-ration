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

  // A non-2xx response isn't guaranteed to be JSON — a platform-level crash
  // or timeout returns an HTML error page instead of anything our backend
  // wrote, and res.json() would throw a cryptic "Unexpected token '<'"
  // that hides what actually happened.
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = (await res.text()).slice(0, 300);
    throw new BackendError(
      `Backend returned a non-JSON response (status ${res.status}): ${text || "(empty body)"}`,
      res.status
    );
  }

  const data = await res.json();
  if (!res.ok) {
    throw new BackendError(data?.error || `Backend request failed with status ${res.status}`, res.status);
  }
  return data as T;
}

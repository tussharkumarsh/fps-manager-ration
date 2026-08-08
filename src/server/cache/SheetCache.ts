/**
 * Simple in-memory, per-process, fps_id-keyed read-through cache. Not shared
 * across serverless invocations — each warm function instance has its own —
 * but cuts repeated Blob reads within a single instance's lifetime, and is
 * explicitly invalidated on writes for a given fps_id.
 */
export class SheetCache<T> {
  private store = new Map<string, { key: string; value: T; expiresAt: number }>();

  constructor(private ttlMs: number) {}

  async getOrLoad(fpsId: string, loader: () => Promise<T>, subKey = ""): Promise<T> {
    const cacheKey = `${fpsId}:${subKey}`;
    const entry = this.store.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    const value = await loader();
    this.store.set(cacheKey, { key: cacheKey, value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  invalidate(fpsId: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${fpsId}:`)) this.store.delete(key);
    }
  }
}

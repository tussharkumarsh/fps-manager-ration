/**
 * What the app keeps in the browser's localStorage between visits.
 *
 * The customer master is deliberately not kept: it is reloaded from the
 * server on every login (useLoadAllHistory), and with thousands of cards it
 * outgrows the browser's ~5 MB localStorage quota — a write past the quota
 * throws on every store update. Transactions are not kept either: the
 * database is their only source of truth.
 */
export const PERSIST_VERSION = 1;

export function persistedSlice<
  S extends { settings: unknown; syncLogs: unknown; scmSyncLogs: unknown; lastSessionKey: unknown },
>(state: S) {
  return {
    settings: state.settings,
    syncLogs: state.syncLogs,
    scmSyncLogs: state.scmSyncLogs,
    lastSessionKey: state.lastSessionKey,
  };
}

/** Upgrades a state saved by an older version: version 0 still carried the customers. */
export function migratePersisted(persisted: unknown, version: number): unknown {
  if (version < 1 && persisted && typeof persisted === "object") {
    const { customers: _dropped, ...rest } = persisted as Record<string, unknown>;
    return rest;
  }
  return persisted;
}

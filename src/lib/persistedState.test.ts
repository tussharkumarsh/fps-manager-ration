import test from "node:test";
import assert from "node:assert/strict";

import { PERSIST_VERSION, migratePersisted, persistedSlice } from "./persistedState";

test("the browser keeps settings and logs, never the customer master", () => {
  const saved = persistedSlice({
    settings: { fpsId: "1" }, customers: [{ srcNo: "A" }], syncLogs: [1], scmSyncLogs: [2], lastSessionKey: "k", transactions: [3],
  });
  assert.deepEqual(Object.keys(saved).sort(), ["lastSessionKey", "scmSyncLogs", "settings", "syncLogs"]);
});

test("an older saved state loses its customers when read back", () => {
  assert.equal(PERSIST_VERSION, 1);
  const old = { settings: { fpsId: "1" }, customers: new Array(3000).fill({ srcNo: "A" }), syncLogs: [] };
  const migrated = migratePersisted(old, 0) as Record<string, unknown>;
  assert.equal("customers" in migrated, false);
  assert.deepEqual(migrated.settings, { fpsId: "1" });
});

import test from "node:test";
import assert from "node:assert/strict";

import { masterCountsBySource, orderSummaries } from "./fpsSummary";
import type { BeneficiaryImport, Customer } from "@/types";

const imp = (sourceFpsId: string, importedAt: string): BeneficiaryImport => ({
  id: sourceFpsId, fpsId: "151209500212", sourceFpsId, sourceFpsName: "", district: "", dfso: "", tfso: "",
  officeCode: "", fileName: "", importedAt, cards: 0, members: 0, aayCards: 0, phhCards: 0,
  footer: {} as BeneficiaryImport["footer"], newCards: 0, updatedCards: 0, missingCards: 0,
});
const card = (srcNo: string, sourceFpsId?: string, portalSyncedAt?: string): Customer => ({
  srcNo, name: srcNo, sourceFpsId, portalSyncedAt,
});

const AT = "2026-11-28T10:00:00.000Z";
const OLD = "2026-11-01T10:00:00.000Z";

test("orderSummaries puts the dealer's own FPS first, then by FPS number", () => {
  const out = orderSummaries([imp("151209500226", AT), imp("151209500212", AT), imp("151209500199", AT)], "151209500212");
  assert.deepEqual(out.map((i) => i.sourceFpsId), ["151209500212", "151209500199", "151209500226"]);
});

test("masterCountsBySource counts cards per source and those not in the latest file", () => {
  const counts = masterCountsBySource(
    [
      card("1", "151209500212", AT),
      card("2", "151209500212", OLD), // an older upload: not in the latest file
      card("3"), // own card imported before sources existed: not in the latest file
      card("4", "151209500199", "2026-11-28T10:00:00+00:00"), // same instant, other format
      card("5", "151209500300", AT), // source never imported here: ignored
    ],
    [imp("151209500212", AT), imp("151209500199", AT)],
    "151209500212"
  );
  assert.deepEqual(counts.get("151209500212"), { inMaster: 3, notInLatest: 2 });
  assert.deepEqual(counts.get("151209500199"), { inMaster: 1, notInLatest: 0 });
  assert.equal(counts.has("151209500300"), false);
});

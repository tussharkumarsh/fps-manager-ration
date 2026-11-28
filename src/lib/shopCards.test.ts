import test from "node:test";
import assert from "node:assert/strict";

import { callMobile, relevantShopIds } from "./shopCards";

test("relevantShopIds unions seen, saved, own and beneficiary sources, dropping blanks", () => {
  const ids = relevantShopIds({
    seen: ["151209500218", "151209500199"],
    saved: ["151209500199", "151209500226"],
    ownFps: "151209500212",
    importSources: ["151209300100", ""],
  });
  assert.deepEqual(Array.from(ids).sort(), [
    "151209300100", "151209500199", "151209500212", "151209500218", "151209500226",
  ]);
  assert.equal(relevantShopIds({ seen: [], saved: [], ownFps: "", importSources: [] }).size, 0);
});

test("callMobile prefers the saved number, then the report, then the masked portal one", () => {
  assert.deepEqual(callMobile({ saved: "9000000001", report: "9000000002", masked: "XXXXX" }), { number: "9000000001", masked: false });
  assert.deepEqual(callMobile({ saved: "", report: "9000000002", masked: "XXXXX" }), { number: "9000000002", masked: false });
  assert.deepEqual(callMobile({ masked: "XXXXXX5536" }), { number: "XXXXXX5536", masked: true });
  assert.deepEqual(callMobile({}), { number: "", masked: false });
});

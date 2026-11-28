import test from "node:test";
import assert from "node:assert/strict";

import { withView } from "./viewParam";

test("withView adds viewFpsId with the right separator, or nothing", () => {
  assert.equal(withView("/api/customers", "151209500212"), "/api/customers?viewFpsId=151209500212");
  assert.equal(withView("/api/transactions?month=11", "151209500212"), "/api/transactions?month=11&viewFpsId=151209500212");
  assert.equal(withView("/api/customers", undefined), "/api/customers");
  assert.equal(withView("/api/customers", ""), "/api/customers");
  assert.equal(withView("/api/x?a=1", "a b"), "/api/x?a=1&viewFpsId=a%20b");
});

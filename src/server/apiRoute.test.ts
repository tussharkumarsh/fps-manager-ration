import test from "node:test";
import assert from "node:assert/strict";

import { makeApiRoute } from "./apiRoute";

const dealer = { fpsId: "151209500212", distCode: "1512", role: "dealer" as const };
const req = new Request("http://x/api/test") as never;

test("no session answers 401 and never runs the handler", async () => {
  let ran = false;
  const GET = makeApiRoute(async () => null)(async () => { ran = true; return Response.json({ ok: true }); });
  const r = await GET(req, undefined as never);
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), { error: "Not authenticated" });
  assert.equal(ran, false);
});

test("the handler gets the session; a thrown error answers JSON 500", async () => {
  const route = makeApiRoute(async () => dealer);
  const ok = await route(async (_req, session) => Response.json({ fps: session.fpsId }))(req, undefined as never);
  assert.deepEqual(await ok.json(), { fps: "151209500212" });

  const boom = await route(async () => { throw new Error("backend down"); })(req, undefined as never);
  assert.equal(boom.status, 500);
  assert.deepEqual(await boom.json(), { error: "backend down" });
});

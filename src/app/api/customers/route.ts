import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { Customer } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const GET = apiRoute(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const viewFpsId = searchParams.get("viewFpsId");

  // Admin with no specific dealer selected sees every dealer's customers
  // combined — the "collective view" across all FPS accounts.
  if (session.role === "admin" && !viewFpsId) {
    const data = await backendFetch<{ customers: (Customer & { fpsId: string; dealerName: string })[]; count: number }>(
      "/customers/all-dealers"
    );
    return NextResponse.json({ success: true, ...data });
  }

  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ customers: Customer[]; count: number }>("/customers", {
    query: { fpsId: dealer.fpsId },
  });
  return NextResponse.json({ success: true, ...data });
});

export const POST = apiRoute(async (req, session) => {
  const { srcNo, name, lastDispatched } = await req.json();
  if (!srcNo || !name) {
    return NextResponse.json({ error: "srcNo and name are required" }, { status: 400 });
  }
  await backendFetch("/customers", {
    method: "POST",
    body: { fpsId: session.fpsId, srcNo, name, lastDispatched },
  });
  return NextResponse.json({ success: true });
});

export const PATCH = apiRoute(async (req, session) => {
  const { srcNo, mobile, scheme, disabled, disabledReason, disabledAt } = await req.json();
  if (!srcNo) {
    return NextResponse.json({ error: "srcNo is required" }, { status: 400 });
  }
  await backendFetch("/customers", {
    method: "PATCH",
    body: { fpsId: session.fpsId, srcNo, mobile, scheme, disabled, disabledReason, disabledAt },
  });
  return NextResponse.json({ success: true });
});

export const DELETE = apiRoute(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const srcNo = searchParams.get("srcNo");
  const all = searchParams.get("all") === "true";

  if (!srcNo && !all) {
    return NextResponse.json({ error: "Missing srcNo (or pass ?all=true to clear everything)" }, { status: 400 });
  }

  await backendFetch("/customers", {
    method: "DELETE",
    query: { fpsId: session.fpsId, srcNo: srcNo || undefined, all: all ? "true" : undefined },
  });
  return NextResponse.json({ success: true });
});

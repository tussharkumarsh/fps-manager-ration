import { NextResponse } from "next/server";
import { apiRoute } from "@/server/route";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { OtherShop } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * The signed-in dealer's contact book of other shops (FPS) whose ration
 * cards collect at their shop. An admin may read a dealer's with
 * ?viewFpsId=; writes are always scoped to the dealer's own session and
 * refused for admins, like the other write flows.
 */
export const GET = apiRoute(async (req, session) => {
  const viewFpsId = new URL(req.url).searchParams.get("viewFpsId");
  if (session.role === "admin" && !viewFpsId) {
    // The collective view has no single dealer's contact book.
    return NextResponse.json({ success: true, shops: [] });
  }
  const dealer = await resolveEffectiveDealer(session, viewFpsId);
  const data = await backendFetch<{ shops: OtherShop[] }>("/other-shops", { query: { fpsId: dealer.fpsId } });
  return NextResponse.json({ success: true, shops: data.shops });
});

export const PUT = apiRoute(async (req, session) => {
  if (session.role === "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { shopFpsId, details } = await req.json();
  if (typeof shopFpsId !== "string" || !/^\d{6,20}$/.test(shopFpsId.trim())) {
    return NextResponse.json({ error: "A numeric FPS number is required" }, { status: 400 });
  }
  const data = await backendFetch<{ shop: OtherShop }>("/other-shops", {
    method: "PUT",
    body: { fpsId: session.fpsId, shopFpsId: shopFpsId.trim(), details },
  });
  return NextResponse.json({ success: true, shop: data.shop });
});

export const DELETE = apiRoute(async (req, session) => {
  if (session.role === "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const shopFpsId = new URL(req.url).searchParams.get("shopFpsId") || "";
  if (!/^\d{6,20}$/.test(shopFpsId.trim())) {
    return NextResponse.json({ error: "A numeric FPS number is required" }, { status: 400 });
  }
  await backendFetch("/other-shops", {
    method: "DELETE",
    query: { fpsId: session.fpsId, shopFpsId: shopFpsId.trim() },
  });
  return NextResponse.json({ success: true });
});

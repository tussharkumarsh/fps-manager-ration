import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { backendFetch } from "@/server/backendClient";
import { resolveEffectiveDealer } from "@/server/resolveEffectiveDealer";
import type { Customer } from "@/types";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { srcNo, name, lastDispatched } = await req.json();
    if (!srcNo || !name) {
      return NextResponse.json({ error: "srcNo and name are required" }, { status: 400 });
    }
    await backendFetch("/customers", {
      method: "POST",
      body: { fpsId: session.fpsId, srcNo, name, lastDispatched },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { srcNo, mobile, disabled, disabledReason, disabledAt } = await req.json();
    if (!srcNo) {
      return NextResponse.json({ error: "srcNo is required" }, { status: 400 });
    }
    await backendFetch("/customers", {
      method: "PATCH",
      body: { fpsId: session.fpsId, srcNo, mobile, disabled, disabledReason, disabledAt },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const srcNo = searchParams.get("srcNo");
  const all = searchParams.get("all") === "true";

  if (!srcNo && !all) {
    return NextResponse.json({ error: "Missing srcNo (or pass ?all=true to clear everything)" }, { status: 400 });
  }

  try {
    await backendFetch("/customers", {
      method: "DELETE",
      query: { fpsId: session.fpsId, srcNo: srcNo || undefined, all: all ? "true" : undefined },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

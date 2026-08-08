import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { TransactionService } from "@/server/services/TransactionService";

// This route reads/writes Vercel Blob storage and must never be statically
// cached or see a cached fetch response.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const transactionService = new TransactionService();

export async function GET() {
  const session = await auth();
  if (!session?.fpsId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const customers = await transactionService.getCustomers(session.fpsId);
    return NextResponse.json({ success: true, customers, count: customers.length });
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
    await transactionService.addCustomer(session.fpsId, { srcNo, name, lastDispatched });
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
  if (!srcNo) {
    return NextResponse.json({ error: "Missing srcNo" }, { status: 400 });
  }

  try {
    await transactionService.deleteCustomer(session.fpsId, srcNo);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

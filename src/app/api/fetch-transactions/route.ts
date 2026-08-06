import { NextRequest, NextResponse } from "next/server";
import { parseEposHtml } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const { distCode, fpsId, month, year } = await req.json();

    if (!distCode || !fpsId || !month || !year) {
      return NextResponse.json(
        { error: "Missing required fields: distCode, fpsId, month, year" },
        { status: 400 }
      );
    }

    const formBody = `dist_code=${encodeURIComponent(distCode)}&fps_id=${encodeURIComponent(fpsId)}&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`;

    const response = await fetch(
      "https://epos.mahafood.gov.in/FPS_Trans_Details.jsp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html",
        },
        body: formBody,
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `ePOS API returned status ${response.status}` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const transactions = parseEposHtml(html);

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
      fetchedAt: new Date().toISOString(),
      params: { distCode, fpsId, month, year },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch transactions: ${message}` },
      { status: 500 }
    );
  }
}

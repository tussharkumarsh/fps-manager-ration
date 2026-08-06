import { NextRequest, NextResponse } from "next/server";

// PDF generation happens client-side with jsPDF
// This route provides data formatting for export
export async function POST(req: NextRequest) {
  try {
    const { type, data, settings } = await req.json();

    return NextResponse.json({
      success: true,
      type,
      formattedData: data,
      settings,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

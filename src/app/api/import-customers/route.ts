import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { Customer } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    // Try to find KGS_Master or first sheet
    const sheetName =
      workbook.SheetNames.find((n) =>
        n.toLowerCase().includes("master")
      ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const customers: Customer[] = [];

    for (const row of rows) {
      // Flexible column matching
      const srcNo = String(
        row["SRCNo"] || row["SRC No"] || row["srcNo"] || row["SRC_No"] || ""
      ).trim();
      const name = String(
        row["Name"] || row["name"] || row["Customer Name"] || row["CustomerName"] || ""
      ).trim();
      const lastDispatched = String(
        row["Last_Dispatched"] || row["LastDispatched"] || row["Last Dispatched"] || ""
      ).trim();

      if (srcNo && srcNo !== "undefined" && srcNo !== "NaN") {
        customers.push({
          srcNo,
          name: name || "Unknown",
          lastDispatched: lastDispatched !== "NaN" ? lastDispatched : undefined,
        });
      }
    }

    return NextResponse.json({
      success: true,
      customers,
      count: customers.length,
      sheetName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to parse Excel: ${message}` },
      { status: 500 }
    );
  }
}

import * as XLSX from "xlsx";
import type { Customer } from "@/types";

/**
 * Parses the "FPS-wise RC & Member Details" export (downloaded from the
 * Maharashtra ration card portal, filename typically
 * FPSBeneficiaryDetailDrillDown.xlsx). It is not a flat table: each ration
 * card's first data row carries the RC No / Status / Area Type, and its
 * member rows below it leave those columns blank (forward-fill), grouped
 * under section headers like "Scheme Name : AAY [2]".
 *
 * Column layout (0-indexed), from the header row containing "S.No."/"Ration
 * Card No.":
 *   0 S.No.            1 Ration Card No.     2 Status
 *   3 Area Type        4 Family Head         5 M.S. No.
 *   6 Member Name(Eng) 7 Member (LL)         8 HoFN
 *   9 Member ID        10 Member's Age       11 UID No.
 *   12 Mobile No.      13 (blank)            14 Relation with HoF
 *   15 (blank)         16 Mother Name        17 Father Name
 *   18 Gender
 *
 * The Ration Card No. is the same 12-digit identifier used as `srcNo`
 * elsewhere in this app (transactions, existing customer imports), so this
 * import enriches/overwrites existing Customer rows keyed by that number.
 */

function cleanStatus(raw: string): string {
  // "Verified and Approved [A]\nApproval Date: ...\nApproved By: ..." -> "Verified and Approved"
  return String(raw).split("\n")[0].replace(/\s*\[[^\]]*\]\s*$/, "").trim();
}

function cleanSchemeLabel(raw: string): string {
  // "Scheme Name :  AAY  [2]" -> "AAY"
  const match = String(raw).match(/Scheme Name\s*:\s*([^\[]+)/i);
  return match ? match[1].trim() : "";
}

export function isBeneficiaryDrillDownSheet(headerRow: unknown[]): boolean {
  const joined = headerRow.map((c) => String(c ?? "").trim()).join("|");
  return joined.includes("Ration Card No.") && joined.includes("S.No.");
}

export function parseBeneficiaryDrillDown(workbook: XLSX.WorkBook): Customer[] {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const headerIdx = rows.findIndex((r) => isBeneficiaryDrillDownSheet(r));
  if (headerIdx === -1) return [];

  const customers: Customer[] = [];
  let currentScheme = "";

  let group: {
    rcNo: string;
    status: string;
    areaType: string;
    headName: string;
    headMobile: string;
    memberCount: number;
  } | null = null;

  const flush = () => {
    if (group && group.rcNo) {
      customers.push({
        srcNo: group.rcNo,
        name: group.headName || "Unknown",
        scheme: currentScheme === "AAY" || currentScheme === "PHH" ? currentScheme : undefined,
        areaType: group.areaType || undefined,
        status: group.status || undefined,
        memberCount: group.memberCount || undefined,
        mobile: group.headMobile || undefined,
      });
    }
    group = null;
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const c0 = String(row[0] ?? "").trim();

    if (c0.startsWith("Scheme Name")) {
      currentScheme = cleanSchemeLabel(c0);
      continue;
    }
    if (c0.startsWith("FPS Detail") || c0.startsWith("Total Ration Cards") || c0.startsWith("Note:")) {
      // Section/footer marker rows carry no member data.
      continue;
    }

    const isNewRcRow = typeof row[0] === "number" && String(row[1] ?? "").trim() !== "";
    if (isNewRcRow) {
      flush();
      group = {
        rcNo: String(row[1]).trim(),
        status: cleanStatus(String(row[2] ?? "")),
        areaType: String(row[3] ?? "").trim(),
        headName: "",
        headMobile: "",
        memberCount: 0,
      };
    }

    if (!group) continue;

    const memberName = String(row[6] ?? "").trim();
    const relation = String(row[14] ?? "").trim();
    if (memberName) {
      group.memberCount++;
      // Prefer the "SELF" row as the representative name/mobile for this
      // ration card; fall back to the first member seen if no SELF row.
      if (relation.toUpperCase() === "SELF" || !group.headName) {
        group.headName = memberName;
        group.headMobile = String(row[12] ?? "").trim();
      }
    }
  }
  flush();

  return customers;
}

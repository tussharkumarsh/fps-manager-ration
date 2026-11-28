import * as XLSX from "xlsx";
import type { BeneficiaryFooter, BeneficiaryMeta, Customer, FamilyMember } from "@/types";

/**
 * Parses the "FPS-wise RC & Member Details" export (downloaded from the
 * Maharashtra ration card portal, filename typically
 * FPSBeneficiaryDetailDrillDown.xlsx). It is not a flat table: each ration
 * card's first data row carries the RC No / Status / Area Type, and its
 * member rows below it leave those columns blank (forward-fill), grouped
 * under section headers like "Scheme Name : AAY [2]".
 *
 * Above the table: District / DFSO / TFSO lines; just below the header,
 * "FPS Detail:<dealer name>(<FPS number>)" names the FPS the file is for.
 * Below the table: a footer row of summary figures and a note row.
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
 * elsewhere in this app (transactions, existing customer imports).
 *
 * Displayed customer name: the "Family Head" column value for that ration
 * card if present, otherwise the name of the member whose M.S. No. is 1.
 * The head's file mobile (usually masked) goes to `portalMobile`; the
 * dealer's own `mobile` is never set from a file.
 */

/**
 * Splits a Status cell — " Verified and Approved [A]\nApproval Date:
 * 31/08/2024 16:11:28\nApproved By: N/A" — into its parts.
 */
export function parseStatusCell(raw: string): {
  status: string; statusCode: string; approvalDate: string; approvedBy: string;
} {
  const lines = String(raw ?? "").split("\n").map((l) => l.trim());
  const first = lines[0] || "";
  const code = first.match(/\[([^\]]*)\]\s*$/);
  const line = (label: string) =>
    lines.find((l) => l.toLowerCase().startsWith(label))?.slice(label.length).replace(/^:\s*/, "").trim() || "";
  return {
    status: first.replace(/\s*\[[^\]]*\]\s*$/, "").trim(),
    statusCode: code ? code[1].trim() : "",
    approvalDate: line("approval date"),
    approvedBy: line("approved by"),
  };
}

function cleanSchemeLabel(raw: string): string {
  // "Scheme Name :  AAY  [2]" -> "AAY"
  const match = String(raw).match(/Scheme Name\s*:\s*([^\[]+)/i);
  return match ? match[1].trim() : "";
}

function isBlankField(v: string): boolean {
  return !v || v === "-" || v === "_";
}

export function isBeneficiaryDrillDownSheet(headerRow: unknown[]): boolean {
  const joined = headerRow.map((c) => String(c ?? "").trim()).join("|");
  return joined.includes("Ration Card No.") && joined.includes("S.No.");
}

/** Reads every footer figure; a label not in the cells (or an #Error cell) gives null. */
export function parseFooter(cells: string[]): BeneficiaryFooter {
  const text = cells.map((c) => String(c ?? "")).join("\n");
  const num = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  const word = (re: RegExp): string | null => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    totalCards: num(/Total Ration Cards:\s*(\d+)/i),
    femaleHof: num(/Female HoF:\s*(\d+)/i),
    // "Female HoF" contains "male HoF": the lookbehinds keep them apart.
    maleHof: num(/(?<!Fe)Male HoF:\s*(\d+)/i),
    maleHofn: word(/(?<!Fe)Male HOFN:\s*([^\n]+)/i),
    femaleHofn: word(/Female HOFN:\s*([^\n]+)/i),
    totalMembers: num(/Total Members:\s*(\d+)/i),
    age0to5: num(/\(0 yrs < Age of member <= 5 yrs\)\s*=\s*(\d+)/i),
    age5to12: num(/\(5 yrs < Age of member <= 12 yrs\)\s*=\s*(\d+)/i),
    age12to60: num(/\(12 yrs < Age of member <= 60 yrs\)\s*=\s*(\d+)/i),
    age60plus: num(/\(60 yrs < Age of member\)\s*=\s*(\d+)/i),
    validUid: num(/(?<!In)Valid Uid:\s*(\d+)/i),
    invalidUid: num(/Invalid Uid:\s*(\d+)/i),
    validMobile: num(/(?<!In)Valid Mobile No\.:\s*(\d+)/i),
    invalidMobile: num(/Invalid Mobile No\.:\s*(\d+)/i),
    female: num(/(?:^|\n)F:\s*(\d+)/),
    male: num(/(?:^|\n)M:\s*(\d+)/),
  };
}

/** "TFSO: TAHSIL OFFICE HINGOLI[1512095]" -> { name, code } */
function headerLine(rows: unknown[][], label: RegExp): { name: string; code: string } {
  for (const r of rows) {
    const m = String(r[0] ?? "").trim().match(label);
    if (m) {
      const value = m[1].trim();
      const code = value.match(/\[(\d+)\]\s*$/);
      return { name: value.replace(/\s*\[\d+\]\s*$/, "").trim(), code: code ? code[1] : "" };
    }
  }
  return { name: "", code: "" };
}

export function parseBeneficiaryFile(workbook: XLSX.WorkBook): {
  customers: Customer[];
  meta: BeneficiaryMeta | null;
  footer: BeneficiaryFooter;
} {
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const headerIdx = rows.findIndex((r) => isBeneficiaryDrillDownSheet(r));
  if (headerIdx === -1) return { customers: [], meta: null, footer: parseFooter([]) };

  const top = rows.slice(0, headerIdx);
  const district = headerLine(top, /^District::?\s*(.*)$/i);
  const dfso = headerLine(top, /^DFSO:\s*(.*)$/i);
  const tfso = headerLine(top, /^TFSO:\s*(.*)$/i);

  let meta: BeneficiaryMeta | null = null;
  let footer = parseFooter([]);
  const customers: Customer[] = [];
  let currentScheme = "";

  let group: {
    sNo: number;
    rcNo: string;
    scheme: string;
    statusRaw: string;
    areaType: string;
    familyHeadField: string;
    members: FamilyMember[];
  } | null = null;

  const flush = () => {
    if (group && group.rcNo) {
      const msNo1 = group.members.find((m) => m.msNo === 1);
      const isBlankHeadField = isBlankField(group.familyHeadField);
      const name = !isBlankHeadField
        ? group.familyHeadField
        : msNo1?.nameEng || group.members[0]?.nameEng || "Unknown";
      const headMobile = msNo1?.mobile || group.members[0]?.mobile || "";
      const st = parseStatusCell(group.statusRaw);

      customers.push({
        srcNo: group.rcNo,
        name,
        sNo: group.sNo,
        scheme: group.scheme === "AAY" || group.scheme === "PHH" ? group.scheme : undefined,
        areaType: group.areaType || undefined,
        status: st.status || undefined,
        statusCode: st.statusCode || undefined,
        approvalDate: st.approvalDate || undefined,
        approvedBy: st.approvedBy || undefined,
        memberCount: group.members.length || undefined,
        portalMobile: isBlankField(headMobile) ? undefined : headMobile,
        familyHead: !isBlankHeadField ? group.familyHeadField : undefined,
        members: group.members,
        sourceFpsId: meta?.sourceFpsId,
        sourceFpsName: meta?.sourceFpsName,
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
    if (c0.startsWith("FPS Detail")) {
      const m = c0.match(/^FPS Detail\s*:\s*(.*)\((\d+)\)\s*$/);
      if (m) {
        meta = {
          sourceFpsId: m[2],
          sourceFpsName: m[1].replace(/s+/g, " ").trim(),
          district: district.name,
          dfso: dfso.name,
          tfso: tfso.name,
          officeCode: tfso.code,
        };
      }
      continue;
    }
    if (c0.startsWith("Total Ration Cards")) {
      flush();
      footer = parseFooter(row.map((c) => String(c ?? "")));
      continue;
    }
    if (c0.startsWith("Note:")) continue;

    const isNewRcRow = typeof row[0] === "number" && String(row[1] ?? "").trim() !== "";
    if (isNewRcRow) {
      flush();
      group = {
        sNo: row[0] as number,
        rcNo: String(row[1]).trim(),
        scheme: currentScheme,
        statusRaw: String(row[2] ?? ""),
        areaType: String(row[3] ?? "").trim(),
        familyHeadField: String(row[4] ?? "").trim(),
        members: [],
      };
    }

    if (!group) continue;

    // A later row within the same ration card can also carry a non-blank
    // Family Head value (e.g. a second head-of-family sub-group) — keep the
    // first non-blank (and non-placeholder, e.g. "-") one seen.
    const rowFamilyHead = String(row[4] ?? "").trim();
    if (isBlankField(group.familyHeadField) && !isBlankField(rowFamilyHead)) {
      group.familyHeadField = rowFamilyHead;
    }

    const memberName = String(row[6] ?? "").trim();
    if (memberName) {
      group.members.push({
        msNo: typeof row[5] === "number" ? row[5] : parseInt(String(row[5]), 10) || 0,
        nameEng: memberName,
        nameLL: String(row[7] ?? "").trim() || undefined,
        hofn: String(row[8] ?? "").trim() || undefined,
        memberId: String(row[9] ?? "").trim() || undefined,
        age: String(row[10] ?? "").trim() || undefined,
        uid: String(row[11] ?? "").trim() || undefined,
        mobile: String(row[12] ?? "").trim() || undefined,
        relation: String(row[14] ?? "").trim() || undefined,
        motherName: String(row[16] ?? "").trim() || undefined,
        fatherName: String(row[17] ?? "").trim() || undefined,
        gender: String(row[18] ?? "").trim() || undefined,
      });
    }
  }
  flush();

  return { customers, meta, footer };
}

/** Cards only (the older entry point). */
export function parseBeneficiaryDrillDown(workbook: XLSX.WorkBook): Customer[] {
  return parseBeneficiaryFile(workbook).customers;
}

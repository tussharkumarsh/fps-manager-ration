import * as XLSX from "xlsx";
import type { SchemeCounts, ShopProfile } from "@/types";

/**
 * Parses the government "FPS Wise Scheme Wise UID Count" report (one file
 * per TFSO). Each shop row carries, in column 3:
 *
 *   NAME (151209500212), FPS Address: Mobile no: 9422555536 ,Shop No:  ,
 *   Vill/Town: Hingoli ,Rationing Tehsil/taluka: Hingoli ,License No: 10/90 ,
 *   Shop Type : T
 *
 * and card/member counts per scheme, each group being RCs, *M1ANARC,
 * Units, *ANAM (meanings not printed in the file; kept verbatim):
 *   na 4,5,6,10 · AAY 11,12,13,14 · PHH 15,18,19,20 · Total 21,22,23,24.
 * A "-" count means none. "Total" and "Percentum" rows end the table.
 */

export interface ShopReportMeta {
  district: string;
  dfso: string;
  tfso: string;
  officeCode: string;
  updatedOn: string;
  updatedAt: string;
}

const COLS: Record<keyof ShopProfile["counts"], [number, number, number, number]> = {
  na: [4, 5, 6, 10],
  aay: [11, 12, 13, 14],
  phh: [15, 18, 19, 20],
  total: [21, 22, 23, 24],
};

/** "20/11/2026 03:22:48 AM" (IST) -> ISO; "" when unreadable. */
export function parseUpdatedOn(raw: string): string {
  const m = String(raw ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "";
  const [, dd, mm, yyyy, hh, mi, ss, ampm] = m;
  let h = Number(hh) % 12;
  if (ampm.toUpperCase() === "PM") h += 12;
  const utc = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), h, Number(mi), Number(ss)) - 330 * 60 * 1000;
  return new Date(utc).toISOString();
}

function cells(wb: XLSX.WorkBook): string[][] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "", raw: false });
}

export function isShopReport(wb: XLSX.WorkBook): boolean {
  return cells(wb).slice(0, 15).some((r) => r.some((c) => String(c).includes("FPS Wise Scheme Wise UID Count")));
}

/** Finds "<label>... [code]" anywhere in the header text; returns the name and the bracketed code. */
function headerValue(text: string, label: RegExp): { name: string; code: string } {
  const m = text.match(label);
  if (!m) return { name: "", code: "" };
  const value = m[1].trim();
  const code = value.match(/\[(\d+)\]\s*$/);
  return { name: value.replace(/\s*\[\d+\]\s*$/, "").trim(), code: code ? code[1] : "" };
}

const blankNA = (v: string) => {
  const s = v.trim();
  return s === "N.A" || s === "N.A." || s === "-" ? "" : s;
};

function count(v: string): number {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function parseShopReport(wb: XLSX.WorkBook): { meta: ShopReportMeta | null; shops: ShopProfile[] } {
  const rows = cells(wb);
  const headerEnd = rows.findIndex((r) => String(r[0]).trim() === "S. No.");
  const header = rows.slice(0, headerEnd === -1 ? 15 : headerEnd).flat().map(String).join("\n");

  const district = headerValue(header, /District:\s*([^\n]*)/i);
  const dfso = headerValue(header, /DFSO:\s*([^\n]*)/i);
  const tfso = headerValue(header, /TFSO:\s*([^\n]*)/i);
  const updatedOn = (header.match(/Updated On:\s*([^\n]*)/i)?.[1] ?? "").trim();
  const updatedAt = parseUpdatedOn(updatedOn);
  const meta: ShopReportMeta | null = updatedAt
    ? { district: district.name, dfso: dfso.name, tfso: tfso.name, officeCode: tfso.code, updatedOn, updatedAt }
    : null;

  const shops: ShopProfile[] = [];
  for (const r of rows) {
    const detail = String(r[3] ?? "");
    const m = detail.match(/^([\s\S]*)\((\d{6,20})\)\s*,\s*FPS Address:\s*([\s\S]*)$/);
    if (!m || !/^\d+$/.test(String(r[0]).trim())) continue;
    const addr = m[3];
    const field = (label: RegExp) => blankNA(addr.match(label)?.[1] ?? "");
    const counts = {} as ShopProfile["counts"];
    for (const [scheme, idx] of Object.entries(COLS) as [keyof ShopProfile["counts"], number[]][]) {
      const c: SchemeCounts = { rcs: count(r[idx[0]]), m1anarc: count(r[idx[1]]), units: count(r[idx[2]]), anam: count(r[idx[3]]) };
      counts[scheme] = c;
    }
    shops.push({
      shopFpsId: m[2],
      officeCode: tfso.code || m[2].slice(0, 7),
      dealerName: m[1].replace(/\s+/g, " ").trim(),
      mobile: field(/Mobile no:\s*([^,]*)/i),
      shopNo: field(/Shop No:\s*([^,]*)/i),
      village: field(/Vill\/Town:\s*([^,]*)/i),
      tehsil: field(/Rationing Tehsil\/taluka:\s*([^,]*)/i),
      licenseNo: field(/License No:\s*([^,]*)/i),
      shopType: field(/Shop Type\s*:\s*([^,]*)/i),
      district: district.name,
      dfso: dfso.name,
      tfso: tfso.name,
      reportUpdatedOn: updatedOn,
      reportUpdatedAt: updatedAt,
      counts,
      uploadedAt: "",
    });
  }
  return { meta, shops };
}

import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { isShopReport, parseShopReport, parseUpdatedOn } from "./shopReport";

const row = (cells: Record<number, string>): string[] => {
  const r = Array(27).fill("");
  for (const [i, v] of Object.entries(cells)) r[Number(i)] = v;
  return r;
};

// Counts by column, laid out as in the real report.
const counts = (na: string[], aay: string[], phh: string[], total: string[]) => ({
  4: na[0], 5: na[1], 6: na[2], 10: na[3],
  11: aay[0], 12: aay[1], 13: aay[2], 14: aay[3],
  15: phh[0], 18: phh[1], 19: phh[2], 20: phh[3],
  21: total[0], 22: total[1], 23: total[2], 24: total[3],
});

function report(): XLSX.WorkBook {
  const rows = [
    row({ 1: "GOVERNMENT OF MAHARASHTRA" }),
    row({ 1: "FPS Wise Scheme Wise UID Count" }),
    row({ 2: "District: Hingoli[512]" }),
    row({ 1: "DFSO:  COLLECTOR OFFICE (BRANCH SUPPLY),HINGOLI[1512]\nTFSO: TAHSIL OFFICE HINGOLI[1512095]" }),
    row({ 1: "Updated On: 20/11/2026 03:22:48 AM" }),
    row({ 0: "S. No.", 3: "FPS Detail", 4: "na [0]", 11: "AAY [2]", 15: "PHH [31]", 21: " Total" }),
    row({ 4: "RCs", 5: "*M1ANARC", 6: "Units", 10: "*ANAM" }),
    row({
      0: "196",
      3: "SHRIDHAR JAGDISH BAmb (151209500212), FPS Address: Mobile no: 9422555536 ,Shop No:  ,Vill/Town: Hingoli ,Rationing Tehsil/taluka: Hingoli ,License No: 10/90 ,Shop Type : T",
      ...counts(["-", "-", "-", "-"], ["104", "104", "460", "460"], ["339", "339", "1572", "1572"], ["443", "443", "2032", "2032"]),
    }),
    row({
      0: "197",
      3: "Ram (Shiv), Mahila Gat (151209500999), FPS Address: Mobile no: N.A ,Shop No: N.A ,Vill/Town: Jamthi Kh. ,Rationing Tehsil/taluka: Hingoli ,License No: 1/94 ,Shop Type : NM",
      ...counts(["0", "0", "0", "0"], ["-", "-", "-", "-"], ["-", "-", "-", "-"], ["0", "0", "0", "0"]),
    }),
    row({ 0: "Total", 3: "TFSO For Selection Total ", ...counts(["0", "0", "0", "0"], ["7581", "7581", "30448", "30448"], ["1", "1", "1", "1"], ["1", "1", "1", "1"]) }),
    row({ 3: "Percentum", 4: "0.00 %" }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "FPSWiseSchemeWiseUIDCountdrilld");
  return wb;
}

test("parseUpdatedOn reads IST 12-hour time", () => {
  assert.equal(parseUpdatedOn("20/11/2026 03:22:48 AM"), "2026-11-19T21:52:48.000Z");
  assert.equal(parseUpdatedOn("20/11/2026 12:05:00 AM"), "2026-11-19T18:35:00.000Z");
  assert.equal(parseUpdatedOn("20/11/2026 12:05:00 PM"), "2026-11-20T06:35:00.000Z");
  assert.equal(parseUpdatedOn("garbage"), "");
});

test("meta comes from the header cells", () => {
  const { meta } = parseShopReport(report());
  assert.deepEqual(meta, {
    district: "Hingoli",
    dfso: "COLLECTOR OFFICE (BRANCH SUPPLY),HINGOLI",
    tfso: "TAHSIL OFFICE HINGOLI",
    officeCode: "1512095",
    updatedOn: "20/11/2026 03:22:48 AM",
    updatedAt: "2026-11-19T21:52:48.000Z",
  });
});

test("a shop row gives contact, licence and counts; '-' is 0", () => {
  const { shops } = parseShopReport(report());
  const s = shops.find((x) => x.shopFpsId === "151209500212")!;
  assert.equal(s.dealerName, "SHRIDHAR JAGDISH BAmb");
  assert.equal(s.mobile, "9422555536");
  assert.equal(s.shopNo, "");
  assert.equal(s.village, "Hingoli");
  assert.equal(s.tehsil, "Hingoli");
  assert.equal(s.licenseNo, "10/90");
  assert.equal(s.shopType, "T");
  assert.equal(s.officeCode, "1512095");
  assert.equal(s.reportUpdatedAt, "2026-11-19T21:52:48.000Z");
  assert.deepEqual(s.counts.aay, { rcs: 104, m1anarc: 104, units: 460, anam: 460 });
  assert.deepEqual(s.counts.na, { rcs: 0, m1anarc: 0, units: 0, anam: 0 });
  assert.deepEqual(s.counts.total, { rcs: 443, m1anarc: 443, units: 2032, anam: 2032 });
});

test("N.A means empty, and a name with commas and brackets keeps the right id", () => {
  const { shops } = parseShopReport(report());
  const s = shops.find((x) => x.shopFpsId === "151209500999")!;
  assert.equal(s.dealerName, "Ram (Shiv), Mahila Gat");
  assert.equal(s.mobile, "");
  assert.equal(s.shopNo, "");
  assert.equal(s.shopType, "NM");
});

test("Total and Percentum rows are not shops", () => {
  assert.deepEqual(parseShopReport(report()).shops.map((s) => s.shopFpsId), ["151209500212", "151209500999"]);
});

test("isShopReport recognises the report and not other sheets", () => {
  assert.equal(isShopReport(report()), true);
  const other = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(other, XLSX.utils.aoa_to_sheet([["S.No.", "Ration Card No."]]), "x");
  assert.equal(isShopReport(other), false);
});

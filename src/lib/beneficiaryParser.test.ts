import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import { parseBeneficiaryFile, parseFooter, parseStatusCell } from "./beneficiaryParser";

const HEADER = [
  "S.No.", "Ration Card No.", "Status", "Area Type", "Family Head ", "M.S. No.",
  "Member Name(in Eng)", "Member (in LL)", "HoFN", "Member ID", "Member's Age*", "UID No.",
  "Mobile No.", "", "Relation with HoF", "", "Mother Name", "Father Name", "Gender", "",
];

// Footer cells laid out as in the real files (cells 0, 6, 7, 10, 11, 12, 18).
function footerRow(): string[] {
  const r = Array(20).fill("");
  r[0] = "Total Ration Cards: 445\nFemale HoF: 158\nMale HoF: 287\nMale HOFN: X\nFemale HOFN: X";
  r[6] = "Total Members: 2040";
  r[7] = "(0 yrs < Age of member <= 5 yrs)=31\n(5 yrs < Age of member <= 12 yrs)=140\n(12 yrs < Age of member <= 60 yrs)=1583\n(60 yrs < Age of member)=286";
  r[10] = "#Error";
  r[11] = "Valid Uid: 2040 Invalid Uid: 0";
  r[12] = "Valid Mobile No.: 480\nInvalid Mobile No.: 1560";
  r[18] = "F: 1016\nM: 1024";
  return r;
}

const STATUS_A = " Verified and Approved [A]\nApproval Date: 31/08/2024 16:11:28\nApproved By: N/A";

function member(card: (string | number)[], msNo: number, name: string, mobile: string, relation: string): (string | number)[] {
  const r: (string | number)[] = card.length ? [...card] : Array(5).fill("");
  r[5] = msNo; r[6] = name; r[7] = ""; r[8] = "X"; r[9] = `ID${msNo}`; r[10] = "40";
  r[11] = "XXXX XXXX 1234"; r[12] = mobile; r[13] = ""; r[14] = relation; r[15] = "";
  r[16] = "MOTHER"; r[17] = "FATHER"; r[18] = "MALE"; r[19] = "";
  return r;
}

function sheet(withFpsDetail = true): XLSX.WorkBook {
  const rows: (string | number)[][] = [
    ["GOVERNMENT OF MAHARASHTRA"],
    ["Department of Food  Civil Supplies and Consumer Affairs"],
    [""],
    ["FPS-wise RC & Member Details  "],
    ["District:: Hingoli[512]"],
    ["DFSO:  COLLECTOR OFFICE (BRANCH SUPPLY),HINGOLI[1512]"],
    ["TFSO: TAHSIL OFFICE HINGOLI[1512095]"],
    ["Scheme:  AAY [2], PHH [31]"],
    [""], [""],
    HEADER,
    ...(withFpsDetail ? [["FPS Detail:RAM SHOP(151209500999)"]] : []),
    ["Scheme Name :  AAY  [2]"],
    member([1, "272000000001", STATUS_A, "Rural", "-"], 1, "HEAD ONE", "XXXXX X8643", "SELF"),
    member([], 2, "WIFE ONE", "-", "WIFE"),
    ["Scheme Name :  PHH  [31]"],
    member([2, "272000000002", " Yet to be Scanned [U]", "Urban", "-"], 1, "HEAD TWO", "-", "SELF"),
    footerRow(),
    ["Note:- If total RC count doesn't match ..."],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "FPSBeneficiaryDetailDrillDown");
  return wb;
}

test("meta comes from the header lines and the FPS Detail line", () => {
  const { meta } = parseBeneficiaryFile(sheet());
  assert.deepEqual(meta, {
    sourceFpsId: "151209500999",
    sourceFpsName: "RAM SHOP",
    district: "Hingoli",
    dfso: "COLLECTOR OFFICE (BRANCH SUPPLY),HINGOLI",
    tfso: "TAHSIL OFFICE HINGOLI",
    officeCode: "1512095",
  });
});

test("cards get their scheme section, member count and source FPS", () => {
  const { customers } = parseBeneficiaryFile(sheet());
  assert.deepEqual(customers.map((c) => [c.srcNo, c.scheme, c.memberCount]), [
    ["272000000001", "AAY", 2],
    ["272000000002", "PHH", 1],
  ]);
  assert.equal(customers[0].sourceFpsId, "151209500999");
  assert.equal(customers[0].sourceFpsName, "RAM SHOP");
  assert.equal(customers[1].statusCode, "U");
  assert.equal(customers[0].approvalDate, "31/08/2024 16:11:28");
});

test("the head's file mobile goes to portalMobile, never to mobile", () => {
  const { customers } = parseBeneficiaryFile(sheet());
  assert.equal(customers[0].portalMobile, "XXXXX X8643");
  assert.equal(customers[0].mobile, undefined);
  assert.equal(customers[1].portalMobile, undefined); // "-" means none
});

test("parseStatusCell splits text, code, approval date and approver", () => {
  assert.deepEqual(parseStatusCell(STATUS_A), {
    status: "Verified and Approved", statusCode: "A",
    approvalDate: "31/08/2024 16:11:28", approvedBy: "N/A",
  });
  assert.deepEqual(parseStatusCell(" Yet to be Scanned [U]"), {
    status: "Yet to be Scanned", statusCode: "U", approvalDate: "", approvedBy: "",
  });
});

test("footer figures are read from the summary row", () => {
  const { footer } = parseBeneficiaryFile(sheet());
  assert.deepEqual(footer, {
    totalCards: 445, femaleHof: 158, maleHof: 287, maleHofn: "X", femaleHofn: "X",
    totalMembers: 2040, age0to5: 31, age5to12: 140, age12to60: 1583, age60plus: 286,
    validUid: 2040, invalidUid: 0, validMobile: 480, invalidMobile: 1560,
    female: 1016, male: 1024,
  });
});

test("a missing footer label or an #Error cell gives null, never a throw", () => {
  const f = parseFooter(["#Error", "Total Members: 12"]);
  assert.equal(f.totalMembers, 12);
  assert.equal(f.totalCards, null);
  assert.equal(f.validMobile, null);
  assert.equal(f.maleHofn, null);
});

test("a sheet without an FPS Detail line has no meta", () => {
  assert.equal(parseBeneficiaryFile(sheet(false)).meta, null);
});

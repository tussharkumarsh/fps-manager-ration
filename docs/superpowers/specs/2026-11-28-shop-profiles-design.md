# Shop profiles from the government shop report, on the Other Shops page

Date: 2026-11-28
Repos: `fps-manager-ration`, `fps-manager-ration-backend`

## Intent

The dealer wants every shop he deals with on one page: his own shop and the
other shops whose cards collect ration at his shop.

Contact details keep coming from the portal API as today. A second government
Excel, "FPS Wise Scheme Wise UID Count" (one file per TFSO, e.g. Hingoli and
Basmath), adds the following for each shop:
- full mobile;
- village, taluka, licence number, shop type;
- card/member counts per scheme.

The FPS-wise beneficiary summary now on Customer Master looks out of place
there and moves to this page.

Sample files: `src/documents/shop/Hingoli.xlsx`, `basmat.xlsx` (git-ignored).

## Goals

- Upload the shop report on the Other Shops page. Only **relevant** shops are
  stored:
  - shops seen in the dealer's transactions;
  - shops saved in his Other Shops book;
  - his own shop;
  - sources of his beneficiary uploads.
- One stored profile per shop. A re-upload refreshes it. An older report never
  overwrites a newer one (compared by the file's "Updated On").
- The Other Shops page shows one card per shop, own shop first. Each card has:
  - portal API data;
  - shop-report data with its date;
  - the beneficiary-file summary with its date;
  - the dealer's own contact;
  - his families and transactions for that shop.
- The FPS-wise summary leaves Customer Master. Its figures appear on the shop
  cards instead.
- The dealer's hand-entered contact is never overwritten.
  - When a contact field is empty, the report's mobile is shown as the number
    to call.
  - The report's mobile is pre-filled when he opens the contact dialog.

## Non-goals

- No change to the portal API fetch.
- Shop Type codes (T/M/P/NM) and the `*M1ANARC` / `*ANAM` columns are shown as
  in the file, without invented meanings.

## File format (verified on both samples)

- One sheet `FPSWiseSchemeWiseUIDCountdrilld`.
- Header text:
  - `District: Hingoli[512]`;
  - a cell with `DFSO: …[1512]\nTFSO: TAHSIL OFFICE HINGOLI[1512095]`;
  - `Updated On: 20/11/2026 03:22:48 AM`.
- Data rows:
  - col 0 S.No.;
  - col 3 `NAME (151209500212), FPS Address: Mobile no: 9422555536 ,Shop No:  ,Vill/Town: Hingoli ,Rationing Tehsil/taluka: Hingoli ,License No: 10/90 ,Shop Type : T`.
- Counts by column. Each group is RCs, *M1ANARC, Units, *ANAM:
  - na: 4, 5, 6, 10;
  - AAY: 11, 12, 13, 14;
  - PHH: 15, 18, 19, 20;
  - Total: 21, 22, 23, 24.
- A count cell of `-` means 0 cards for that scheme.
- The "Total" and "Percentum" rows end the table.
- Hingoli has 318 shops and Basmath 279. All 8 relevant shops are present.

## Design

- **Backend table `fps_shop_profiles`** (shared like `fps_directory`; public
  government data). Columns:
  - `shop_fps_id` pk, `office_code`;
  - `dealer_name`, `mobile`, `shop_no`, `village`, `tehsil`, `license_no`, `shop_type`;
  - `district`, `dfso`, `tfso`;
  - `report_updated_on` (text as in file), `report_updated_at` (timestamptz, IST parsed);
  - `counts` jsonb `{ na|aay|phh|total: { rcs, m1anarc, units, anam } }`;
  - `uploaded_at`.

  RLS on.
- **Pure `pickNewer(existing, incoming)`** keeps the profile with the later
  `report_updated_at` (ties → incoming). Tested.
- **Routes:**
  - `GET /other-shops/profiles?ids=`;
  - `POST /other-shops/profiles {profiles}`, which validates ids, caps at 500 and
    upserts via `pickNewer`. It returns `{ saved, skippedOlder }`.
- **Frontend parser `parseShopReport(wb)`** → `{ meta: { district, dfso, tfso,
  officeCode, updatedOn, updatedAt }, shops: ShopProfile[] }`. Tested on a
  synthetic sheet.
- **Upload** (Other Shops page, dealer only):
  1. Parse in the browser.
  2. Keep relevant ids.
  3. POST them.
  4. Report: "Hingoli report (20/11/2026): 7 of 318 shops saved · 311 not
     related to your shop".
- **Page:**
  - The table becomes a card grid, own shop first. The search box stays.
  - The beneficiary summary comes from `GET /api/customers/imports`.
  - The `FpsSummary` component is removed from Customer Master. Its figures move
    into the shop card.

## Calls I made

1. Report profiles are stored in one shared table, like the portal directory,
   because it is public data.
2. An older report never replaces a newer one.
3. Mobile shown to call: the dealer's saved mobile, else the report mobile,
   else the masked portal mobile.

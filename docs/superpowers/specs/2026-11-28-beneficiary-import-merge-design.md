# Beneficiary file import: merge, source FPS, and FPS-wise summary

Date: 2026-11-28
Repos: `fps-manager-ration` (Next.js frontend) and `fps-manager-ration-backend` (Express + Supabase)

## Intent

The dealer downloads the government "FPS-wise RC & Member Details" Excel
(`FPSBeneficiaryDetailDrillDown`) from the portal, one file per FPS. He wants
to upload these files again and again, for his own FPS and for nearby FPSs,
so Customer Master always holds the latest official data.

The hand work already in Customer Master must survive every upload:
- real mobile numbers he typed in (266 today);
- the disabled marks with reasons (53 today).

He also wants to see, for each uploaded FPS, the official summary block printed
at the bottom of the file.

Sample files: `src/documents/*.xlsx` (7 FPSs, all the same layout).

## Goals

- Upload merges into the existing master, keyed by ration card number:
  - an existing card gets its file data refreshed and missing fields filled;
  - a new card is added;
  - no duplicates are ever created.
- Every card records:
  - **which FPS's file** it came from (FPS number + dealer name from the file);
  - **when its data was last updated** from a file.
- All fields in the file are stored. This adds approval date and approved by,
  which are not stored today.
- File-level facts are stored per upload:
  - district, DFSO, TFSO;
  - the footer summary.
- A separate **FPS-wise summary** component on Customer Master. It shows each
  uploaded FPS's official footer figures and when that FPS was last uploaded.
- The dealer's own counts (Customers page, dashboard, reports) use only cards
  of his own FPS.

## Non-goals

- No deleting of the master; no "replace all" import.
- No change to how transactions are synced.
- No reading of the portal API for this data; upload only.

## Anti-goals (would be a failure even if it "works")

- A masked file mobile (`XXXXX X8643`) overwriting a real mobile number. The
  current import does this today, and it must stop.
- An upload re-enabling a disabled card, or clearing its reason.
- Another FPS's cards inflating the dealer's Registered or Pending counts.
- Two rows for one ration card.

## What the file contains (verified on all 7 samples)

- One sheet, 20 columns. The header row has "S.No." and "Ration Card No."
  (row 11).
- Top lines:
  - `District:: Hingoli[512]`
  - `DFSO: …[1512]`
  - `TFSO: TAHSIL OFFICE HINGOLI[1512095]` (the 300100 file says BASMATH[1512093])
  - `Scheme: AAY [2], PHH [31]`
- `FPS Detail:SHRIDHAR JAGDISH BAmb(151209500212)` gives the source FPS name and
  number.
- `Scheme Name : AAY [2]` and `Scheme Name : PHH [31]` are section rows. Every
  card below one belongs to that scheme.
- A card's first row has these fields; its member rows leave them blank:
  - S.No., Ration Card No.;
  - Status, as `Verified and Approved [A]\nApproval Date: dd/mm/yyyy hh:mm:ss\nApproved By: N/A`;
  - Area Type, Family Head.
- Each member row has:
  - M.S. No., name (Eng), name (local language), HoFN (`X` or `_/`);
  - Member ID, Age, UID (masked), Mobile (masked or `-`);
  - Relation, Mother name, Father name, Gender.
- Status values seen: `Verified and Approved [A]`, `Yet to be Scanned [U]`.
- The footer row (`Total Ration Cards: …`) has, in cells:
  - total ration cards, Female HoF, Male HoF, Male HOFN, Female HOFN;
  - total members;
  - the four age bands;
  - the member's-age cell is `#Error` and is ignored;
  - valid / invalid UID;
  - valid / invalid mobile;
  - F / M.
- A note row follows.
- The file carries **no generation date**. "Last updated" is therefore the upload
  time.

Own FPS (…212) today:
- 445 cards in the file, 440 of them already in the master.
- 36 of those 440 are marked disabled.
- 13 own cards that have transactions are absent from the file.

## Approaches considered

- **A. Merge on the server, plus a new table for per-upload summaries (chosen).**
  - New columns on `customers`.
  - A `beneficiary_imports` table stores each upload's FPS, header and footer
    figures.
  - The merge rules live in one backend function with tests.
- B. Merge in the browser and derive the summary from customers.
  - Rejected: the footer figures (e.g. valid mobile 480) cannot be rebuilt from
    masked data.
  - Merge rules in the browser are easier to get wrong.

## Design

### Data (Supabase, backend repo `supabase/schema.sql` + migration)

New columns on `customers`. All are nullable; existing rows keep null.

| column | meaning |
|---|---|
| `source_fps_id` | FPS number from the file's "FPS Detail" line |
| `source_fps_name` | dealer name from that line |
| `portal_synced_at` (timestamptz) | when this card was last present in an uploaded file |
| `approval_date` (text, `dd/mm/yyyy hh:mm:ss` as in file) | from Status cell |
| `approved_by` | from Status cell |
| `status_code` | `A` / `U` from Status cell (status text stays in `status`) |
| `portal_mobile` | the head's mobile exactly as in the file (often masked) |

New table `beneficiary_imports`, one row per upload:
- `id`, `fps_id` (the dealer account);
- `source_fps_id`, `source_fps_name`;
- `district`, `dfso`, `tfso`, `office_code`;
- `imported_at`, `file_name`;
- `cards`, `members`, `aay_cards`, `phh_cards`;
- `footer` (jsonb with every footer figure, keys below);
- `new_cards`, `updated_cards`, `missing_cards` (results of the merge).

RLS enabled, no policies (same as other tables).

Footer jsonb keys:
- `totalCards`, `femaleHof`, `maleHof`, `maleHofn`, `femaleHofn`;
- `totalMembers`, `age0to5`, `age5to12`, `age12to60`, `age60plus`;
- `validUid`, `invalidUid`, `validMobile`, `invalidMobile`;
- `female`, `male`.

### Parsing (frontend `src/lib/beneficiaryParser.ts`)

- Extend the existing parser. It returns:
  `{ customers, meta: { sourceFpsId, sourceFpsName, district, dfso, tfso, officeCode }, footer }`.
- Status cell: split into `status` (text), `statusCode`, `approvalDate`,
  `approvedBy`.
- The head's file mobile goes to `portalMobile`, never to `mobile`.
- Footer: parse numbers with regexes per label; a missing label → null.
- If no "FPS Detail" line is found, the import is refused with a clear error.

### Merge (backend, one pure function + repository)

Pure function `mergeBeneficiary(existing | undefined, incoming, importedAt)` →
row, unit-tested.
- **Key:** `(fps_id = dealer account, src_no)`. This is the existing primary
  key, so duplicates are impossible.
- **From file, always overwritten when the file has a value:**
  - name, family head;
  - scheme, s_no;
  - area type, status, status code, approval date, approved by;
  - member count, members;
  - `portal_mobile`;
  - `source_fps_id`, `source_fps_name`.
- **Set on every card in the file:** `portal_synced_at = importedAt`.
- **Never touched by an import:**
  - `mobile` (the dealer's own number);
  - `disabled`, `disabled_reason`, `disabled_at`;
  - `last_dispatched`.
  - Exception: if `mobile` is empty and the file mobile is a full 10-digit
    number, it is filled.
- **New card:**
  - inserted with the file data;
  - `mobile` only if the file mobile is a full number;
  - not disabled.
- **Cards of the same source FPS absent from this upload:**
  - not deleted;
  - counted in `missing_cards`;
  - shown as "not in latest file" (their `portal_synced_at` is older than that
    FPS's latest import).
- One import = one request carrying meta + footer + cards, chunked as today.
  - The first chunk creates the `beneficiary_imports` row.
  - Later chunks send its id.
  - The last chunk finalises the counts.
  - My call: if chunking makes this awkward, the frontend can send meta/footer
    in a final separate call. Either way, one row per upload.
- The KGS-master format import keeps working. It has no source FPS and goes
  through the old field merge.

### Which cards are "my customers"

`isOwnCard(c, dealerFpsId)`:
- returns true when `source_fps_id` is empty (all 940 existing rows) or equals
  the dealer's FPS;
- otherwise the card belongs to another FPS.

This is applied in:
- Customers page counts and list (default filter);
- `customersWithTransactions` callers: dashboard family summary and reports.

Other-FPS cards stay in the master:
- they appear under a filter on the Customers page;
- they give names to other-shop (portability) families.

The existing "only customers with at least one transaction" rule stays on top
of this.

### UI (frontend)

- **FPS-wise summary component** on Customer Master (`src/components/customers/FpsSummary.tsx`):
  - one card per source FPS, from its latest upload;
  - each card shows:
    - FPS number + name, TFSO;
    - last upload date ("x days ago");
    - total cards (AAY/PHH);
    - Female/Male HoF;
    - members;
    - age bands;
    - valid/invalid UID;
    - valid/invalid mobile;
    - F/M;
  - the own FPS card comes first and is highlighted;
  - a small line under each card compares master and file, e.g.
    "In master: 440 · New this upload: 5 · Not in latest file: 13".
- **Customers table:**
  - new column "Source FPS";
  - new column "Updated" (date from `portal_synced_at`);
  - new filter chips: "Other FPS cards" and "Not in latest file";
  - the expanded row shows the approval date / approved by;
  - the expanded row shows the file mobile next to the dealer's mobile.
- **After an upload:**
  - the result banner says "FPS 151209500212 (SHRIDHAR …): 445 cards — 440
    updated, 5 new, 13 not in this file";
  - the page reloads customers from the server, so the merged result is shown,
    not the parsed file.
- **Upload of another FPS's file:** allowed, as the dealer wants that. The
  banner names the FPS so a wrong file is obvious.
- All new text in en/hi/mr.

### Read path

- `GET /customers` returns the new fields.
- New `GET /customers/imports?fpsId=` returns each source FPS's latest import
  row (and optionally history).
- Frontend proxy routes mirror these routes.

## Constraints

- Vercel request body limit (~4.5 MB): keep the existing size-based chunking.
- Supabase REST: keep reading existing rows by `fps_id` (no huge `in` lists).
- Admin is read-only. Admin can view the summary but never upload.

## Left to the builder

- Exact visual layout of the summary cards, within the existing card and
  KPICard style.
- Whether to keep import history visible (latest per FPS is required; history
  is optional).
- Migration name and ordering.

## Calls I made (for the dealer to check)

1. Data "last updated" = the upload time, because the file has no date of its
   own.
2. Existing 940 rows with no source FPS count as the dealer's own cards.
3. File mobile is kept separately and never replaces a real mobile.
4. Cards missing from a newer file are flagged, never deleted.
5. Other FPSs' cards never count in the dealer's own figures.

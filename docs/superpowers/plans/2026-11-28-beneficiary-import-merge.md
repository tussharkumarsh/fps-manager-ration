# Beneficiary Import Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-uploading the government beneficiary file merges into Customer Master. The merge preserves the dealer's manual mobile numbers and disable marks, and records each card's source FPS and last-updated time. Each uploaded FPS gets an FPS-wise summary.

**Architecture:**
- The frontend parses the Excel into cards, file meta and footer.
- The backend merges each card onto its existing row with a pure, tested function, and stores one `beneficiary_imports` row per upload.
- The Customers page shows a summary card per source FPS. Dealer-facing counts use only own-FPS cards.

**Tech Stack:** Next.js 15 + zustand + xlsx (frontend), Express + Supabase (backend), node:test via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-28-beneficiary-import-merge-design.md`

## Global Constraints

- Key is `(fps_id, src_no)`; never create a second row for a card.
- An import never writes:
  - `mobile`, except to fill an empty one with a full 10-digit number;
  - `disabled`, `disabled_reason`, `disabled_at`;
  - `last_dispatched`.
- File mobile goes to `portal_mobile` only.
- Cards absent from a newer upload are flagged ("not in latest file"), never deleted.
- `isOwnCard`: `source_fps_id` is empty or equals the dealer's FPS. Only own cards count in dealer figures.
- "Last updated" = upload time (`portal_synced_at`), because the file has no date.
- Keep size-based chunking (`MAX_CHUNK_BYTES = 3_000_000`). Read existing rows by `fps_id` only.
- Admin is read-only: may view the summary, never upload.
- All new UI text in en/hi/mr. Code, comments and commits in English.
- Real beneficiary files are git-ignored. Tests build synthetic sheets with `XLSX.utils.aoa_to_sheet`.

## Review Focus

1. **Re-upload of the same file twice:**
   - the second upload reports 0 new and N updated;
   - the row count is unchanged.
   - Pinned in Task 2 (`merge is idempotent`).
2. **Existing card with a real mobile and a disabled mark, file has a masked mobile:**
   - mobile and disable fields are unchanged;
   - `portal_mobile` = masked value.
   - Pinned in Task 2.
3. **Another FPS's file uploaded into the dealer's account:**
   - those cards get `source_fps_id` = that FPS;
   - Registered and Pending counts don't change.
   - Pinned in Task 6 (`isOwnCard` tests).
4. **File without an "FPS Detail" line, or a KGS master file:**
   - the drill-down without FPS Detail is refused with a clear error;
   - the KGS master still imports through the old path.
   - Pinned in Task 4.
5. **Footer cells with `#Error` or a missing label:**
   - that figure is `null`;
   - parsing does not throw.
   - Pinned in Task 4.

---

### Task 1: Schema — new customer columns and `beneficiary_imports`

**Files:**
- Modify: backend `supabase/schema.sql`
- Apply: Supabase migration `beneficiary_import_merge` (project `ezfjcthgdufrlfdkqmgy`)

- [ ] **Step 1:** Add `alter table customers add column if not exists` for:
  - `source_fps_id text`, `source_fps_name text`;
  - `portal_synced_at timestamptz`;
  - `approval_date text`, `approved_by text`, `status_code text`;
  - `portal_mobile text`.
- [ ] **Step 2:** Create table `beneficiary_imports` with columns:
  - `id uuid default gen_random_uuid() primary key`;
  - `fps_id text not null`;
  - `source_fps_id text not null`, `source_fps_name text not null default ''`;
  - `district`, `dfso`, `tfso` (text, default '');
  - `office_code text`;
  - `file_name text default ''`;
  - `imported_at timestamptz not null`;
  - `cards`, `members`, `aay_cards`, `phh_cards` (int, default 0);
  - `footer jsonb not null default '{}'`;
  - `new_cards`, `updated_cards`, `missing_cards` (int, default 0).

  Also: index `(fps_id, source_fps_id, imported_at desc)`; enable RLS.
- [ ] **Step 3:** Apply via `apply_migration`. Verify with `list_tables` that the columns exist.
- [ ] **Step 4:** Commit backend: `feat: schema for beneficiary import merge`.

### Task 2: Backend merge function

**Files:**
- Create: backend `src/lib/beneficiaryMerge.ts`
- Modify: backend `src/types.ts`: add to `Customer`:
  - `sourceFpsId?`, `sourceFpsName?`, `portalSyncedAt?`;
  - `approvalDate?`, `approvedBy?`, `statusCode?`, `portalMobile?` (all `string`).
- Test: backend `tests/beneficiary-merge.test.ts`

**Interfaces:**
- Produces:
  - `export type CustomerRow` (moved here from CustomerRepository; adds the 7 snake_case columns);
  - `export type WritableCustomerRow = Omit<CustomerRow, "disabled" | "disabled_reason" | "disabled_at">`;
  - `export function isFullMobile(v?: string | null): boolean`, which accepts exactly 10 digits after stripping spaces;
  - `export function mergeBeneficiary(fpsId: string, existing: CustomerRow | undefined, incoming: Customer, importedAt: string): WritableCustomerRow`.

- [ ] **Step 1: Write failing tests**
  - `new card takes file data; mobile only when full`:
    - with incoming `portalMobile "XXXXX X8643"`, the result has `mobile` null and `portal_mobile` "XXXXX X8643";
    - with incoming `portalMobile "9876543210"`, the result has `mobile` "9876543210";
    - `portal_synced_at === importedAt`.
  - `existing real mobile and disable survive`:
    - existing has `mobile "9876543210"`, `disabled true`, `disabled_reason "moved"`, `last_dispatched "Oct"`;
    - incoming has a masked mobile and a new name;
    - the result keeps mobile and `last_dispatched`, has no `disabled*` keys, and takes the new name.
  - `file fields overwrite, blanks do not`:
    - incoming `status "Verified and Approved"`, `statusCode "A"`, empty `areaType`;
    - status is updated; the old `area_type` is kept.
  - `merge is idempotent`: `mergeBeneficiary(x, merge(x))` deep-equals `merge(x)` for the same importedAt.
  - `source FPS is replaced by the latest file`: existing `source_fps_id null`, incoming `"151209500199"` → `"151209500199"`.
- [ ] **Step 2:** Run `npx tsx --test tests/beneficiary-merge.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement. Start from `{...existing}` minus the disabled fields, or a blank row. Copy every non-empty file field. Apply the mobile rule and set `portal_synced_at`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit backend: `feat: beneficiary merge rules`.

### Task 3: Backend import + summary endpoints

**Files:**
- Modify: backend `src/repositories/CustomerRepository.ts`:
  - import the row types from Task 2;
  - map the new columns in `rowToCustomer` / `customerToRow`.
- Create: backend `src/repositories/BeneficiaryImportRepository.ts`
- Modify: backend `src/services/TransactionService.ts`, `src/routes/customers.ts`
- Test: backend `tests/beneficiary-merge.test.ts` (summary counting helper)

**Interfaces:**
- Consumes: `mergeBeneficiary`, `CustomerRow`.
- Produces:
  - `CustomerRepository.importBeneficiaries(fpsId, customers: Customer[], importedAt: string): Promise<{ saved: number; newCards: number; updatedCards: number }>`.
  - `BeneficiaryImportRepository`:
    - `record(row: BeneficiaryImport): Promise<BeneficiaryImport>`;
    - `latestPerSource(fpsId): Promise<BeneficiaryImport[]>`.
  - `export interface BeneficiaryImport` in `src/types.ts`, camelCase of the Task 1 table.
  - `footer: BeneficiaryFooter`, where `BeneficiaryFooter` is `Record<"totalCards"|"femaleHof"|"maleHof"|"totalMembers"|"age0to5"|"age5to12"|"age12to60"|"age60plus"|"validUid"|"invalidUid"|"validMobile"|"invalidMobile"|"female"|"male", number | null> & { maleHofn: string | null; femaleHofn: string | null }`.
  - `POST /customers/import`:
    - body `{ fpsId, customers, importedAt? }`;
    - when `importedAt` is present, it uses `importBeneficiaries` and returns `{ savedCount, newCards, updatedCards }`;
    - otherwise it uses the old `upsertMany` path.
  - `POST /customers/imports`:
    - body `{ fpsId, import: Omit<BeneficiaryImport,"id"|"missingCards"> }`;
    - the server computes `missingCards`: rows with that `source_fps_id` and `portal_synced_at` < `importedAt`, or null;
    - returns `{ success, import }`.
  - `GET /customers/imports?fpsId=` → `{ success, imports }`.
  - Pure `countMissing(rows: CustomerRow[], sourceFpsId: string, importedAt: string): number` in `beneficiaryMerge.ts`.

- [ ] **Step 1:** Write failing test `countMissing counts only same-source cards not touched by this upload`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the repositories, service and routes. Keep the read-back verify in `importCustomers` for both paths. Batch upserts at 200.
- [ ] **Step 4:** Run `npx tsx --test tests/*.test.ts` and `npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5:** Commit backend: `feat: merge beneficiary imports and record per-FPS summaries`.

### Task 4: Frontend parser — meta, status split, footer

**Files:**
- Modify: `src/lib/beneficiaryParser.ts`, `src/types/index.ts`:
  - same 7 new Customer fields as the backend;
  - `BeneficiaryImport`, `BeneficiaryFooter`, `BeneficiaryMeta`.
- Test: `src/lib/beneficiaryParser.test.ts`

**Interfaces:**
- Produces:
  - `export interface BeneficiaryMeta { sourceFpsId: string; sourceFpsName: string; district: string; dfso: string; tfso: string; officeCode: string }`.
  - `export function parseBeneficiaryFile(wb: XLSX.WorkBook): { customers: Customer[]; meta: BeneficiaryMeta | null; footer: BeneficiaryFooter }`.
    - `parseBeneficiaryDrillDown` stays as `parseBeneficiaryFile(wb).customers`.
  - `export function parseStatusCell(raw: string): { status: string; statusCode: string; approvalDate: string; approvedBy: string }`.
  - `export function parseFooter(cells: string[]): BeneficiaryFooter`.
  - Each customer gets `sourceFpsId`/`sourceFpsName` from meta, and the head's mobile in `portalMobile`. `mobile` is no longer set by this parser.

- [ ] **Step 1: Write failing tests** on a synthetic sheet. The sheet has:
  - the top lines;
  - `FPS Detail:RAM SHOP(151209500999)`;
  - `Scheme Name : AAY [2]`, with one card of 2 members;
  - `Scheme Name : PHH [31]`, with one card;
  - a footer row with the real cell layout (cells 0, 6, 7, 10 `#Error`, 11, 12, 18);
  - the note row.

  Tests:
  - meta: `sourceFpsId "151209500999"`, `sourceFpsName "RAM SHOP"`, `officeCode "1512095"`, `tfso "TAHSIL OFFICE HINGOLI"`.
  - schemes: `["AAY","PHH"]`; `memberCount` 2 and 1.
  - `parseStatusCell(" Verified and Approved [A]\nApproval Date: 31/08/2024 16:11:28\nApproved By: N/A")` → `{status:"Verified and Approved", statusCode:"A", approvalDate:"31/08/2024 16:11:28", approvedBy:"N/A"}`.
  - The head mobile `"XXXXX X8643"` lands in `portalMobile`, and `mobile` is undefined.
  - footer, from the 151209500212 sample text:
    - `totalCards 445`, `femaleHof 158`, `maleHof 287`;
    - `totalMembers 2040`;
    - `age0to5 31`, `age5to12 140`, `age12to60 1583`, `age60plus 286`;
    - `validUid 2040`, `invalidUid 0`;
    - `validMobile 480`, `invalidMobile 1560`;
    - `female 1016`, `male 1024`;
    - `maleHofn "X"`.
  - A footer with an `#Error`-only cell, or a missing label → that key is `null`.
  - A sheet without an FPS Detail line → `meta === null`.
- [ ] **Step 2:** Run `npx tsx --test src/lib/beneficiaryParser.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Header lines use regexes on `District::`, `DFSO:`, `TFSO:`, and `FPS Detail:(.*)\((\d+)\)`. `officeCode` is the bracketed number of TFSO. The footer uses one regex per label over the joined cells.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit frontend: `feat: parse beneficiary file meta, status and footer`.

### Task 5: Frontend import route and summary API

**Files:**
- Modify: `src/app/api/import-customers/route.ts`
- Create: `src/app/api/customers/imports/route.ts` (GET, honours `viewFpsId` via `resolveEffectiveDealer`)

**Interfaces:**
- Consumes: `parseBeneficiaryFile`, backend endpoints from Task 3.
- Produces:
  - Drill-down import response: `{ success, format:"beneficiary_drilldown", meta, count, newCards, updatedCards, missingCards, importedAt }`.
  - The KGS path response is unchanged.
  - `GET /api/customers/imports` → `{ success, imports: BeneficiaryImport[] }`.

- [ ] **Step 1:** Drill-down path:
  1. If `meta` is null, return 400 with "This file has no FPS Detail line".
  2. Set `importedAt = new Date().toISOString()`.
  3. Send the chunks with `importedAt`, summing `newCards`/`updatedCards`.
  4. Then `POST /customers/imports` with meta, footer, counts and `file.name`.
  5. Return the response above.

  Uploading is refused for admin, as today.
- [ ] **Step 2:** Add the GET proxy.
- [ ] **Step 3:** Run `npx tsc --noEmit -p .`. Expected: no errors.
- [ ] **Step 4:** Commit frontend: `feat: import route merges beneficiary files and records the summary`.

### Task 6: Own-FPS cards only in dealer figures

**Files:**
- Modify:
  - `src/lib/familySummary.ts`;
  - `src/app/customers/page.tsx`;
  - `src/app/dashboard/page.tsx`;
  - `src/app/reports/page.tsx`;
  - `src/app/settings/page.tsx`.
- Test: `src/lib/familySummary.test.ts`

**Interfaces:**
- Produces:
  - `export function isOwnCard(c: Customer, dealerFpsId: string): boolean`.
  - `customersWithTransactions(customers, transactions, dealerFpsId?: string)` drops non-own cards when `dealerFpsId` is given.

- [ ] **Step 1: Failing tests:**
  - `isOwnCard` is true for empty source and for the same FPS, and false for another FPS.
  - `customersWithTransactions` with a dealerFpsId drops a transacted card whose source is another FPS.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Pass the dealer FPS (`viewingDealer?.fpsId ?? settings.fpsId`) at every existing call site.
- [ ] **Step 4:** Run all frontend tests and tsc. Expected: PASS.
- [ ] **Step 5:** Commit frontend: `feat: count only own-FPS cards in dealer figures`.

### Task 7: FPS-wise summary and Customers page changes

**Files:**
- Create:
  - `src/components/customers/FpsSummary.tsx`;
  - `src/lib/fpsSummary.ts` (pure helpers);
  - `src/lib/fpsSummary.test.ts`.
- Modify: `src/app/customers/page.tsx`, `src/lib/i18n/translations.ts`

**Interfaces:**
- Consumes: `GET /api/customers/imports`, `isOwnCard`, Customer fields from Task 4.
- Produces:
  - `export function masterCountsBySource(customers: Customer[], imports: BeneficiaryImport[]): Map<string, { inMaster: number; notInLatest: number }>`:
    - `notInLatest` = cards of that source with `portalSyncedAt` older than its latest import.
  - `export function orderSummaries(imports: BeneficiaryImport[], ownFpsId: string): BeneficiaryImport[]`: own first, then by FPS id.
  - `<FpsSummary imports customers ownFpsId />`.

- [ ] **Step 1: Failing tests** for both helpers:
  - own FPS first;
  - `notInLatest` counts the old-synced card only;
  - a card of a never-imported source is ignored.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the helpers.
- [ ] **Step 4:** Build `FpsSummary`. Each card shows:
  - FPS number + name, TFSO, and "Updated <date>";
  - Total cards (AAY/PHH), Female/Male HoF, members;
  - the 4 age bands;
  - UID valid/invalid, mobile valid/invalid, F/M;
  - the line "In master N · New X · Not in latest file M".

  The own card is highlighted.
- [ ] **Step 5:** Customers page:
  - Render `FpsSummary` above the KPIs; it loads imports on mount and after an import.
  - Add columns "Source FPS" (ShopTag for another FPS, "Own shop" otherwise) and "Updated" (`portalSyncedAt` date).
  - Add filter chips "Other FPS cards" and "Not in latest file".
  - The default list and counts use own cards only.
  - The expanded row shows approval date, approved by, and the file mobile.
  - After an import, show the banner "FPS {id} ({name}): {count} cards — {updated} updated, {new} new, {missing} not in this file". Then reload customers from `/api/customers` into the store with `setCustomers`.
- [ ] **Step 6:** Add i18n keys en/hi/mr. Run tests, tsc and `npx next build`. Expected: pass.
- [ ] **Step 7:** Commit frontend: `feat: FPS-wise beneficiary summary on Customer Master`.

### Task 8: End-to-end check against the real file

- [ ] **Step 1:** Run a scratchpad Node script that:
  - parses `src/documents/151209500212.xlsx` with `parseBeneficiaryFile`;
  - checks there are 445 cards (AAY 104, PHH 341);
  - checks the footer `totalCards` is 445;
  - checks `meta.sourceFpsId` is `151209500212`;
  - checks all 7 files parse with their FPS id.
- [ ] **Step 2:** Read-only SQL: confirm that the 266 real mobiles and the 53 disabled rows are unchanged before any upload.
- [ ] **Step 3:** Report to the dealer. He uploads the files himself.

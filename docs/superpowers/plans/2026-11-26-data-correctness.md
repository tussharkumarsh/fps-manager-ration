# Data Correctness & Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dealer-facing stock and distribution numbers correct: SCM carry-forward, auto-recompute, commodity normalization, no silent column loss, IST month, no stale cache, safe and rate-limited login, and a one-click backfill of missing months.

**Architecture:** Backend changes in `c:\freelanceProject\fps-manager-ration-backend` (Express + Supabase). The pure logic goes in small `src/lib/*` modules with `node:test` tests; services call into it. Frontend changes in `c:\freelanceProject\fps-manager-ration` (Next.js) add a sync-status API route, a pure backfill helper, a Sync page button, and an Opening column.

**Tech Stack:** TypeScript, Express, @supabase/supabase-js, cheerio, Next.js 15 / NextAuth, `node:test` via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-26-data-correctness-design.md`

## Global Constraints
- Re-sync NEVER deletes receipts. Transaction writes stay upsert-only.
- The admin/dealer tenant model and the admin collective view are unchanged.
- "Current month" = calendar month in `Asia/Kolkata`.
- Login lockout: 10 failed attempts per identifier per 15 minutes.
- Commodity canonical names: `Wheat`, `Rice` (from `Rice`, `FRice`, `F.Rice`, `Fortified Rice`), `Sugar`, `Jowar`, `SAREE` (from `Saree`, `Saree Kit`). Matching is case-insensitive; unknown names are trimmed and kept as-is.
- Month/year strings are stored unpadded (`"7"`, not `"07"`), matching the existing data.
- Backend tests: `cd c:\freelanceProject\fps-manager-ration-backend && npx tsx --test tests/*.test.ts`. Typecheck: `npm run lint`.
- Frontend typecheck: `cd c:\freelanceProject\fps-manager-ration && npx tsc --noEmit`.

## Review Focus
1. Year boundary: the January opening must come from the previous year's December closing (tested in Task 3).
2. The commodity name changes from `FRice` (June) to `Rice` (July) mid-year; the carry-forward chain must continue across the rename (tested in Task 3).
3. A scheme/commodity with previous closing ≠ 0 but no receipts this month must still appear, with opening = closing (tested in Task 3).
4. An IST/UTC boundary such as 2026-11-30T20:00Z, which is already 1 Dec in IST (tested in Task 1).
5. Backfill for a past year includes all 12 months; for a future year it includes none (tested in Task 7).

---

### Task 1: Commodity normalization + IST month helpers

**Files:**
- Create: `fps-manager-ration-backend/src/lib/commodity.ts`
- Modify: `fps-manager-ration-backend/src/lib/ids.ts`
- Test: `fps-manager-ration-backend/tests/helpers.test.ts`

**Interfaces:**
- Produces: `normalizeCommodity(name: string): string`; `txFieldForCommodity(name: string): "wheat"|"rice"|"sugar"|"saree"|"jowar"|null` (works on raw or canonical names); `currentIstYearMonth(now?: Date): { year: string; month: string }` in `ids.ts`.

- [ ] **Step 1: Write the failing tests**
```ts
test('normalizeCommodity canonicalizes rice and saree variants', () => {
  assert.equal(normalizeCommodity('FRice'), 'Rice');
  assert.equal(normalizeCommodity(' fortified rice '), 'Rice');
  assert.equal(normalizeCommodity('Saree Kit'), 'SAREE');
  assert.equal(normalizeCommodity('wheat'), 'Wheat');
  assert.equal(normalizeCommodity(' Bajra '), 'Bajra');
});
test('txFieldForCommodity maps FRice to rice and unknown to null', () => {
  assert.equal(txFieldForCommodity('FRice'), 'rice');
  assert.equal(txFieldForCommodity('Bajra'), null);
});
test('currentIstYearMonth uses Asia/Kolkata', () => {
  assert.deepEqual(currentIstYearMonth(new Date('2026-11-30T20:00:00Z')), { year: '2026', month: '12' });
  assert.deepEqual(currentIstYearMonth(new Date('2026-11-30T18:00:00Z')), { year: '2026', month: '11' });
});
```
- [ ] **Step 2: Run, expect FAIL** (modules/exports missing).
- [ ] **Step 3: Implement.** Use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' })`; return the month unpadded.
- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** `feat: add commodity normalization and IST month helpers`.

### Task 2: ePOS parser keeps unknown commodity columns, refuses headerless tables

**Files:**
- Modify: `src/lib/eposParser.ts`, `src/types.ts` (`Transaction.extraItems?: Record<string, number>`), `src/clients/GovApiClient.ts`, `src/repositories/TransactionRepository.ts`, `supabase/schema.sql`
- Test: `tests/scm-inventory.test.ts` (existing failing test is rewritten), `tests/epos-parser.test.ts`

**Interfaces:**
- Produces: `parseEposReport(html: string): { transactions: Transaction[]; unknownColumns: string[] }`. `parseEposHtml(html)` stays as a wrapper returning `.transactions`. `GovApiClient.fetchTransactions(...)` returns `{ transactions, unknownColumns }`.
- DB: `alter table transactions add column if not exists extra_items jsonb not null default '{}'::jsonb;` (appended to `schema.sql`; applied in Task 6).

- [ ] **Step 1: Write the failing tests.** Build fixtures with a two-row `<thead>`. Row A: `Sl No, SRC No, Scheme, Avail Type, Receipt No, Date`, a `<th colspan=N>Qty in Kgs</th>`, then `Amount, Portability, Auth Trans Time`. Row B: the commodity labels.
  - `parseEposReport stores an unknown commodity column in extraItems`: sub-headers `Wheat, Rice, Bajra, Jowar`, with Bajra = `2.000` → `transactions[0].extraItems` deep-equals `{ Bajra: 2 }`, `unknownColumns` deep-equals `['Bajra']`, and wheat/rice/jowar/amount/portability are correct.
  - `parseEposReport throws when the commodity header cannot be read`: the existing headerless fixture → `assert.throws(() => parseEposReport(html), /header/i)`.
  - Rewrite the existing test 3 to use the two-row header (`Wheat, Rice, Sugar, SAREE, Jowar`), keeping its expected values; `extraItems` is `{}`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Any sub-header index not claimed by wheat/rice/sugar/saree/jowar is an unknown column, keyed by its trimmed header text. Remove the positional fallback branch and throw `Error("ePOS report header not recognised — commodity columns could not be mapped")` instead. In the repository, write and read `extra_items`.
- [ ] **Step 4: Run, expect PASS** (all tests, including the previous 2).
- [ ] **Step 5: Commit** `fix: keep unknown ePOS commodity columns and refuse headerless tables`.

### Task 3: SCM summary with carry-forward, built from a pure function

**Files:**
- Create: `src/lib/scmSummary.ts`
- Modify: `src/types.ts` (`InventoryMonthlySummary.openingStock: number`), `src/services/ScmInventoryService.ts`, `src/repositories/ScmInventoryRepository.ts` (read/write `opening_stock`)
- Test: `tests/scm-summary.test.ts`

**Interfaces:**
- Consumes: `normalizeCommodity`, `txFieldForCommodity` (Task 1); `previousMonth` (`ids.ts`); `currentIstYearMonth` (Task 1).
- Produces:
  - `buildMonthSummary(input: { fpsId: string; year: string; month: string; scmTxns: ScmInventoryTransaction[]; localTxns: Transaction[]; previous: InventoryMonthlySummary[] }): InventoryMonthlySummary[]`
  - `ScmInventoryService.recomputeFrom(fpsId: string, year: string, fromMonth: string): Promise<void>`. It recomputes `fromMonth` up to 12, or up to the current IST month when `year` is the current IST year, in order. Each month's `previous` is the summary just computed for the prior month; for `fromMonth` itself, `previous` is read from the DB (for month 1, that is Dec of `year-1`).
  - `recomputeYear(fpsId, year)` becomes `recomputeFrom(fpsId, year, "1")`.

Rules for `buildMonthSummary`, per key `scheme|normalizeCommodity(commodity)`:
- `received` = sum of `receivedQty` from the SCM transactions.
- `distributed` = the local transaction sum for that scheme and `txFieldForCommodity`; when there is no tx field, the sum of `dispatchedQty`.
- `opening` = the previous row's `closingStock` (0 if none). `closing = opening + received − distributed`.
- The key set is the union of: keys from the SCM transactions; keys from previous rows with `closingStock ≠ 0`; and `scheme|Commodity` keys for local fields with distributed > 0 (field → canonical: wheat→Wheat, rice→Rice, sugar→Sugar, jowar→Jowar, saree→SAREE).
- Rows are sorted by key. The old `UNKNOWN` placeholder rows are dropped.

- [ ] **Step 1: Write the failing tests**
  - `carries previous closing into opening`: previous PHH Rice closing −74; this month received 3066, local PHH rice 3162 → opening −74, closing −170.
  - `continues the chain across the FRice→Rice rename`: previous row commodity `FRice` normalized as `Rice` with closing 10; SCM txn `Rice` received 5, no local → one PHH `Rice` row, opening 10, closing 15.
  - `keeps a carried row with no receipts this month`: previous AAY SAREE closing 80; no SCM txns; local AAY saree 10 → row opening 80, received 0, distributed 10, closing 70.
  - `uses dispatchedQty for commodities without a local field`: SCM `Bajra` dispatched 50 → distributed 50.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `buildMonthSummary`, then `recomputeFrom`. Make `syncMonth` call `recomputeFrom(fpsId, year, month)` after storing, instead of the inline summary computation. Persist `opening_stock`, and also set `carried_forward_qty = closing_stock`.
- [ ] **Step 4: Run, expect PASS**, then `npm run lint`.
- [ ] **Step 5: Commit** `feat: carry SCM opening stock forward and normalize commodities`.

### Task 4: SyncService — no cache, IST month, auto-recompute, warnings, locks endpoint

**Files:**
- Modify: `src/services/SyncService.ts`, `src/routes/transactions.ts`, `src/repositories/MonthLockRepository.ts`
- Delete: `src/cache/SheetCache.ts`

**Interfaces:**
- Consumes: `currentIstYearMonth` (Task 1); `ScmInventoryService.recomputeFrom` (Task 3); `fetchTransactions → { transactions, unknownColumns }` (Task 2).
- Produces: `MonthDataResult.unknownColumns: string[]` (empty on stored reads). `GET /transactions` includes `unknownColumns`. New `GET /transactions/locks?fpsId=&year=` → `{ success: true, locks: { month: string; status: "live"|"synced_locked"; recordCount: number }[] }` via `MonthLockRepository.listForYear(fpsId, year)`.

- [ ] **Step 1:** Remove `SheetCache` and read straight from `txnRepo.getForMonth`. Replace `isCurrentMonth` with a comparison against `currentIstYearMonth()`. After `fetchAndStore`, call `new ScmInventoryService().recomputeFrom(fpsId, year, month)`; if it throws, log it and don't fail the transaction sync. Add the locks route.
- [ ] **Step 2:** Run `npm run lint` and the full tests → PASS. Run `grep -r SheetCache src` → no hits.
- [ ] **Step 3: Commit** `refactor: drop in-memory month cache, use IST month, recompute SCM after sync`.

### Task 5: Safe login lookup + rate limit

**Files:**
- Create: `src/lib/loginLimit.ts`, `src/repositories/LoginAttemptRepository.ts`
- Modify: `src/repositories/UserRepository.ts`, `src/services/AuthService.ts`, `src/routes/auth.ts`, `supabase/schema.sql`
- Test: `tests/login-limit.test.ts`

**Interfaces:**
- Produces: `MAX_FAILED_ATTEMPTS = 10`, `LOCKOUT_WINDOW_MS = 15 * 60 * 1000`, `isLockedOut(failedAt: Date[], now: Date): boolean`. `LoginAttemptRepository.recentFailures(identifier: string, since: Date): Promise<Date[]>`, `.recordFailure(identifier: string)`, `.clear(identifier: string)`. `verifyCredentials` returns `AuthResult | null | "locked"`. `/auth/verify` returns `{ success: true, result: null, locked: true }` when locked. The frontend needs no change: `null` makes NextAuth show its generic failure.
- DB: `create table if not exists login_attempts (identifier text not null, attempted_at timestamptz not null default now()); create index if not exists login_attempts_idx on login_attempts (identifier, attempted_at);`

- [ ] **Step 1: Write the failing tests:** 9 failures within 15 min → `false`; 10 → `true`; 10 failures that are all 16 min old → `false`.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `findByFpsId` runs `.eq("fps_id", id).maybeSingle()`, then falls back to `.eq("username", id).maybeSingle()`. The identifier key is `trim().toLowerCase()`. Record a failure on a wrong password or unknown user; clear on success.
- [ ] **Step 4: Run, expect PASS**, plus `npm run lint`.
- [ ] **Step 5: Commit** `fix: parameterize login lookup and rate-limit failed logins`.

### Task 6: Apply DB migration + recompute existing data

- [ ] **Step 1:** Apply the `extra_items` column and the `login_attempts` table to Supabase project `ezfjcthgdufrlfdkqmgy` (migration `data_correctness_2026_11_26`). The user confirms the tool call.
- [ ] **Step 2:** Verify with `select column_name from information_schema.columns where table_name='transactions' and column_name='extra_items';` → 1 row. `login_attempts` exists.
- [ ] **Step 3:** Commit the `schema.sql` changes if they are not already committed.

(The recompute of 2026 for existing dealers runs from the deployed app's Inventory "Recompute" button after deploy; it is noted in the hand-off, not done here.)

### Task 7: Frontend — backfill button + unknown-column warning

**Files:**
- Create: `fps-manager-ration/src/lib/backfill.ts`, `src/lib/backfill.test.ts`, `src/app/api/sync-status/route.ts`
- Modify: `src/app/sync/page.tsx`, `src/lib/i18n/translations.ts` (en/hi/mr)

**Interfaces:**
- Consumes: backend `GET /transactions/locks` (Task 4); `/api/fetch-transactions` response now carries `unknownColumns`.
- Produces: `monthsToBackfill(year: string, locks: { month: string; status: string }[], now: { year: string; month: string }): string[]`. `GET /api/sync-status?year=` (session-scoped, dealer only) → `{ success, locks }`.

- [ ] **Step 1: Write the failing tests** (`npx tsx --test src/lib/backfill.test.ts`):
  - current year 2026, now month 11, locks synced_locked for 7–10 → `['1','2','3','4','5','6','11']`
  - past year 2025 with no locks → `'1'..'12'`
  - future year 2027 → `[]`
  - the current month is included even when it is locked.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the helper, the route (403 for admin, like the other write flows) and the UI: a "Sync missing months" button under the fetch form. It calls `/api/sync-status`, computes the months, then POSTs `/api/fetch-transactions` for each month sequentially and shows `Month X: N records` or the error on each line, continuing past failures. It merges results with `addTransactions`. When any response has a non-empty `unknownColumns`, an amber warning names them. Add the i18n keys `sync.backfillButton`, `sync.backfillRunning`, `sync.backfillDone`, `sync.unknownColumns` in all 3 languages. `now` comes from `Intl` with `Asia/Kolkata`.
- [ ] **Step 4: Run tests → PASS**; `npx tsc --noEmit` → no errors.
- [ ] **Step 5: Commit** `feat: add sync missing months button and unknown commodity warning`.

### Task 8: Frontend — show Opening in the SCM summary

**Files:** Modify the SCM summary table in `src/app/inventory/page.tsx` (and `dashboard/page.tsx` if it renders closing), plus i18n.

- [ ] **Step 1:** Add an "Opening" column before "Received", reading `openingStock` (or `opening_stock`, depending on what the `/api/inventory/scm` GET returns; check the backend `rowToSummary`).
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3: Commit** `feat: show SCM opening stock`.

## Deviation from spec
The spec ends the backfill with one year-wide recompute. Task 4 already recomputes from each synced month onward, so a final recompute would be redundant and is dropped.

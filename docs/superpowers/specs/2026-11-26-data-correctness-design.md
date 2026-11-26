# Data correctness & backfill (Option B) — design

Date: 2026-11-26 · Repos: `fps-manager-ration` (Next.js) + `fps-manager-ration-backend` (Express/Supabase)

## Intent
Dealers log in with their FPS ID and see exactly how much ration came in, how much they distributed, and what's left. The tenant model stays as is: one global admin and many dealers, each scoped to their own `fps_id`. The numbers on screen must match the government portal's figures and must never silently drop data.

## What the audit found (2026-11-26, FPS 151209500212)
- Transaction parsing is correct. For Jul–Oct 2026, serial numbers run 1..N with no gaps, there are no duplicate receipts, scheme and avail-type values are clean, and date and portability land in the right columns.
- The SCM summary has a hard-coded `opening_stock = 0`, so closing stock is wrong month to month. The gov register confirms carry-forward is right: our July PHH rice closing is −74, and the gov Aug rice opening is −74.
- The SCM summary goes stale. It is only computed at SCM sync time, so a later transaction re-sync doesn't update it (Sep PHH wheat shows 1567 in the summary vs 1583 in transactions).
- The commodity name `FRice` (used Jan–Jun) isn't mapped to `rice`. Its "distributed" therefore falls back to the gov dispatch figure instead of local sales, and its carry-forward chain would also break when the name changes FRice→Rice.
- The transaction parser only knows wheat, rice, sugar, saree and jowar. Any other commodity column is dropped silently.
- "Current month" is computed in server time (UTC on Vercel), which is wrong from 00:00 to 05:30 IST on the 1st.
- Every month's transactions are cached in each serverless instance's memory for 5 minutes, so reads can be stale across instances.
- `UserRepository.findByFpsId` puts the raw login identifier inside a PostgREST `.or()` filter (filter injection), and login attempts have no limit.
- Jan–Jun 2026 and Nov 2026 transactions were never synced.

## Goals
1. SCM summary opening = previous month's closing for the same scheme and normalized commodity; closing = opening + received − distributed.
2. The SCM summary is recomputed automatically after every transaction sync of that month, and the recompute pass walks months in order so carry-forward chains stay consistent.
3. Commodity names are normalized (`FRice`/`F.Rice`/`Fortified Rice` → `Rice`, `Saree Kit` → `SAREE`, case-insensitive) everywhere they are matched.
4. Unknown commodity columns in the ePOS table are kept, not dropped: they are stored in a new `transactions.extra_items jsonb` column (`{"<header>": qty}`), and the sync response returns a warning naming them.
5. "Current month" is computed in Asia/Kolkata.
6. The in-memory month cache is removed; reads go straight to Supabase.
7. Login lookup uses two parameterized `.eq()` queries (by `fps_id`, then `username`) instead of a string-built `.or()`. Login is rate-limited to 10 failed attempts per identifier per 15 minutes, tracked in a new `login_attempts` table, so the limit works across serverless instances.
8. A "Sync missing months" button on the Sync page fetches, one month at a time, every month of the selected year (up to the current month) that has no `synced_locked` lock, plus the current month. It shows per-month progress and finishes with one SCM summary recompute for the year.

## Non-goals
- **Re-sync never deletes receipts.** Receipts present in the DB but missing from a fresh gov response stay. The upsert-only behavior is unchanged (explicit user decision).
- No change to the admin/dealer model or the admin collective view (option C is deferred).
- No change to the manual inventory ledger or the gov stock register snapshot logic.

## Approaches considered
- A — correctness and security only: too narrow, because the dealer-facing stock numbers stay wrong.
- **B — A + carry-forward + backfill (chosen):** fixes what the dealer actually sees.
- C — B + scalable admin aggregates: deferred, since there are only 2 dealers today.

## Calls made by Claude (correct if wrong)
- The first month with no previous summary starts at opening 0. It is not seeded from the gov stock register, because the register is per commodity across schemes while the summary is per scheme.
- Backfill runs client-side, one request per month, so each request stays well under Vercel's 60s limit and progress is visible.
- The backfill range is Jan of the selected year through the current month.
- The cache is removed rather than moved to Supabase. Reads are cheap, and correctness matters more.

## Out of scope / open
- The gov portal could not be reached from the dev machine (connection resets), so the parser was not re-checked against live HTML. A saved copy of `FPS_Trans_Details.jsp` output would allow a fixture-based parser test.

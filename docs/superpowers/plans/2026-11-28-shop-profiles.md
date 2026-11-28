# Shop Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Store relevant shops from the government "FPS Wise Scheme Wise UID Count" report and show every shop (own first) as a card on Other Shops, with the beneficiary summary moved there.

**Architecture:**
- The browser parses the report and keeps only relevant shop ids.
- The backend stores one profile per shop in a shared `fps_shop_profiles` table; a newer report always wins.
- The Other Shops page merges portal, report, beneficiary-summary and contact data per shop.

**Tech Stack:** Next.js 15, zustand, xlsx; Express + Supabase; node:test via `npx tsx --test`.

**Spec:** `docs/superpowers/specs/2026-11-28-shop-profiles-design.md`

## Global Constraints

- Store only relevant shops:
  - seen in transactions;
  - saved in the book;
  - own shop;
  - beneficiary upload sources.
- Never overwrite the dealer's saved contact; never let an older report replace a newer one.
- Shop Type and `*M1ANARC`/`*ANAM` are shown verbatim.
- Admin is read-only: no upload.
- New UI text in en/hi/mr. Code, comments and commits in English.

## Review Focus

1. A `-` count cell is 0, not NaN. Pinned in Task 2.
2. A shop name with commas or brackets before `(FPS)`: the FPS id is the last `(12 digits)` before `, FPS Address`. Pinned in Task 2.
3. Re-uploading an older report leaves the newer profile intact. Pinned in Task 1.
4. "Mobile no: N.A" means no mobile (empty). Pinned in Task 2.
5. "Updated On" in 12-hour AM/PM IST converts to the correct instant (12 AM → 00, 12 PM → 12). Pinned in Task 2.

---

### Task 1: Backend table, merge rule, routes

**Files:**
- Modify `supabase/schema.sql` and apply migration `fps_shop_profiles`.
- Create `src/lib/shopProfile.ts`.
- Create `src/repositories/ShopProfileRepository.ts`.
- Modify `src/routes/otherShops.ts`.
- Test: `tests/shop-profile.test.ts`.

**Interfaces (produces):**
- `interface ShopProfile`, with these fields:
  - `shopFpsId`, `officeCode`;
  - `dealerName`, `mobile`, `shopNo`, `village`, `tehsil`, `licenseNo`, `shopType`;
  - `district`, `dfso`, `tfso`;
  - `reportUpdatedOn: string`, `reportUpdatedAt: string`;
  - `counts: Record<"na"|"aay"|"phh"|"total", { rcs: number; m1anarc: number; units: number; anam: number }>`;
  - `uploadedAt: string`.
- `pickNewer(existing: ShopProfile | undefined, incoming: ShopProfile): ShopProfile`.
- `sanitizeProfile(raw: unknown): ShopProfile | null`: valid id, strings trimmed and capped, numbers finite or 0.
- `GET /other-shops/profiles?ids=` → `{ success, profiles }`.
- `POST /other-shops/profiles {profiles}` → `{ success, saved, skippedOlder }`.

- [ ] **Step 1: Tests**
  - `pickNewer keeps the later report`: existing `2026-11-20T…`, incoming `2026-10-01T…` → existing.
  - `ties go to incoming`.
  - `sanitizeProfile drops a bad id and fills missing counts with 0`.
- [ ] **Step 2:** Watch the tests fail. Implement, then watch them pass. Run the full suite and `tsc`.
- [ ] **Step 3:** Commit: `feat: store shop profiles from the government shop report`.

### Task 2: Frontend parser

**Files:**
- Create `src/lib/shopReport.ts`.
- Create `src/lib/shopReport.test.ts`.
- Modify `src/types/index.ts`: `ShopProfile` mirrors the backend.

**Interfaces:**
- `parseShopReport(wb): { meta: { district; dfso; tfso; officeCode; updatedOn; updatedAt } | null; shops: ShopProfile[] }`.
- `parseUpdatedOn("20/11/2026 03:22:48 AM"): string`. It returns ISO for that IST time, i.e. `2026-11-19T21:52:48.000Z`.
- `isShopReport(wb): boolean`.

- [ ] **Step 1: Tests on a synthetic sheet with the real row layout**
  - Meta, with officeCode `1512095`.
  - A shop row gives:
    - `mobile "9422555536"`, `village "Hingoli"`, `licenseNo "10/90"`, `shopType "T"`;
    - counts `aay {rcs:104,m1anarc:104,units:460,anam:460}`.
  - A `-` cell → 0.
  - `Mobile no: N.A` → `""`.
  - A name with a comma and brackets keeps the right id.
  - `12:05:00 AM` and `12:05:00 PM` convert correctly.
  - Total and Percentum rows are ignored.
- [ ] **Step 2:** RED, then GREEN. Run both real files through a scratch script: 318 and 279 shops, all 8 relevant ids found.
- [ ] **Step 3:** Commit: `feat: parse the government shop report`.

### Task 3: Upload, store hook, Other Shops cards, summary move

**Files:**
- Create API proxies `src/app/api/other-shops/profiles/route.ts` (GET, POST; POST refused for admin).
- Modify `src/store/useOtherShops.ts`: profiles map, `loadProfiles(ids)`, `saveProfiles(list)`.
- Create `src/lib/shopCards.ts` + test.
- Modify:
  - `src/app/other-shops/page.tsx` (card grid, upload);
  - `src/components/otherShops/ShopDialog.tsx` (pre-fill mobile from the report);
  - `src/app/customers/page.tsx` (remove `FpsSummary`).
- Delete `src/components/customers/FpsSummary.tsx`. Move its helpers' use to the shop card.
- Modify `src/lib/i18n/translations.ts`.

**Interfaces:**
- `relevantShopIds({ seen, saved, ownFps, importSources }): Set<string>`.
- `callMobile({ saved?: string; report?: string; masked?: string }): { number: string; masked: boolean }`.

- [ ] **Step 1: Tests**
  - `relevantShopIds` unions all four sources and drops empty values.
  - `callMobile` prefers saved, then report, then masked (with `masked: true`).
- [ ] **Step 2:** RED, then GREEN.
- [ ] **Step 3:** Build the page:
  - Cards, own shop first, with sections for portal / report (with date) / beneficiary file (with date) / your contact / activity.
  - The upload button shows a result line.
  - Search filters the cards.
- [ ] **Step 4:** Run tsc, the tests and `next build`.
- [ ] **Step 5:** Commit: `feat: shop cards with report and beneficiary summaries on Other Shops`.

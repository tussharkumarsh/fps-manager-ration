import type { BeneficiaryImport, Customer } from "@/types";

/** The source FPS a card counts under: an empty source is the dealer's own. */
export function sourceOf(c: Customer, ownFpsId: string): string {
  return c.sourceFpsId || ownFpsId;
}

/** Latest upload time per source FPS (ms). */
export function latestBySource(imports: BeneficiaryImport[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of imports) {
    const t = new Date(i.importedAt).getTime();
    if (!(t <= (m.get(i.sourceFpsId) ?? -Infinity))) m.set(i.sourceFpsId, t);
  }
  return m;
}

/**
 * A card whose source FPS has been uploaded, but whose latest upload did
 * not include it (moved away, cancelled, or never in a file).
 */
export function isNotInLatestFile(c: Customer, latest: Map<string, number>, ownFpsId: string): boolean {
  const at = latest.get(sourceOf(c, ownFpsId));
  if (at === undefined) return false;
  return !c.portalSyncedAt || new Date(c.portalSyncedAt).getTime() !== at;
}

/** Per uploaded source FPS: cards in the master, and those not in its latest file. */
export function masterCountsBySource(
  customers: Customer[],
  imports: BeneficiaryImport[],
  ownFpsId: string
): Map<string, { inMaster: number; notInLatest: number }> {
  const latest = latestBySource(imports);
  const out = new Map<string, { inMaster: number; notInLatest: number }>();
  for (const src of Array.from(latest.keys())) out.set(src, { inMaster: 0, notInLatest: 0 });
  for (const c of customers) {
    const entry = out.get(sourceOf(c, ownFpsId));
    if (!entry) continue;
    entry.inMaster++;
    if (isNotInLatestFile(c, latest, ownFpsId)) entry.notInLatest++;
  }
  return out;
}

/** Summaries with the dealer's own FPS first, the rest by FPS number. */
export function orderSummaries(imports: BeneficiaryImport[], ownFpsId: string): BeneficiaryImport[] {
  return [...imports].sort(
    (a, b) =>
      Number(b.sourceFpsId === ownFpsId) - Number(a.sourceFpsId === ownFpsId) ||
      a.sourceFpsId.localeCompare(b.sourceFpsId)
  );
}

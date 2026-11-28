/**
 * Shops related to this dealer: seen in his transactions, saved in his
 * Other Shops book, his own shop, and the sources of his beneficiary-file
 * uploads. Only these are kept from a government shop report.
 */
export function relevantShopIds(src: {
  seen: string[];
  saved: string[];
  ownFps: string;
  importSources: string[];
}): Set<string> {
  const out = new Set<string>();
  for (const id of [...src.seen, ...src.saved, src.ownFps, ...src.importSources]) {
    const v = String(id ?? "").trim();
    if (v) out.add(v);
  }
  return out;
}

/**
 * The number to call a shop on: the dealer's own saved number, else the
 * government report's full number, else the portal's masked one (flagged).
 */
export function callMobile(src: { saved?: string; report?: string; masked?: string }): { number: string; masked: boolean } {
  if (src.saved?.trim()) return { number: src.saved.trim(), masked: false };
  if (src.report?.trim()) return { number: src.report.trim(), masked: false };
  if (src.masked?.trim()) return { number: src.masked.trim(), masked: true };
  return { number: "", masked: false };
}

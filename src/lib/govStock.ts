import type { GovStockRegisterEntry } from "@/types";

export interface GovStockFigures {
  opening: number;
  received: number;
  issued: number;
  closing: number;
}

const ALIASES: Record<string, string> = {
  frice: "rice",
  "f.rice": "rice",
  "fortified rice": "rice",
  "saree kit": "saree",
};

/** Lower-case commodity key so inventory item names ("Saree Kit") match register names ("SAREE"). */
export function canonicalCommodity(name: string): string {
  const key = (name || "").trim().replace(/\s+/g, " ").toLowerCase();
  return ALIASES[key] ?? key;
}

/**
 * The government's own stock register for a month, keyed by canonical
 * commodity. Received includes every receipt kind the register reports
 * (regular, extra RO, 6A case).
 */
export function govStockByCommodity(
  entries: Pick<GovStockRegisterEntry, "commodity" | "opening" | "receivedRegular" | "receivedExtra" | "receivedMoved" | "issued" | "closing">[]
): Map<string, GovStockFigures> {
  const map = new Map<string, GovStockFigures>();
  for (const e of entries) {
    const key = canonicalCommodity(e.commodity);
    const prev = map.get(key);
    const received = (e.receivedRegular || 0) + (e.receivedExtra || 0) + (e.receivedMoved || 0);
    map.set(key, {
      opening: (prev?.opening ?? 0) + (e.opening || 0),
      received: (prev?.received ?? 0) + received,
      issued: (prev?.issued ?? 0) + (e.issued || 0),
      closing: (prev?.closing ?? 0) + (e.closing || 0),
    });
  }
  return map;
}

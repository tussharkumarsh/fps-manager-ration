import { clsx, type ClassValue } from "clsx";
import type { Transaction, DailySummary, MonthlyStats, ChartDataPoint } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getMonthName(month: number): string {
  return new Date(2026, month - 1).toLocaleString("en", { month: "long" });
}

export function calculateMonthlyStats(transactions: Transaction[]): MonthlyStats {
  const totalWheat = transactions.reduce((s, t) => s + t.wheat, 0);
  const totalRice = transactions.reduce((s, t) => s + t.rice, 0);
  const totalSaree = transactions.reduce((s, t) => s + t.saree, 0);
  const phhCount = transactions.filter((t) => t.scheme === "PHH").length;
  const aayCount = transactions.filter((t) => t.scheme === "AAY" && t.wheat > 0).length;
  const uniqueCustomers = new Set(transactions.map((t) => t.srcNo)).size;
  const authCount = transactions.filter((t) => t.availType === "Authenticated").length;
  const otpCount = transactions.filter((t) => t.availType === "OTP").length;
  const irisCount = transactions.filter((t) => t.availType === "IRIS").length;
  const portabilityCount = transactions.filter((t) => t.portability !== "Self").length;
  const activeDays = new Set(transactions.map((t) => t.date.split(" ")[0])).size;

  return {
    totalWheat,
    totalRice,
    totalSaree,
    phhCount,
    aayCount,
    uniqueCustomers,
    authCount,
    otpCount,
    irisCount,
    portabilityCount,
    activeDays,
    totalTransactions: transactions.length,
  };
}

export function calculateDailySummary(transactions: Transaction[]): DailySummary[] {
  const byDate: Record<string, DailySummary> = {};

  transactions.forEach((t) => {
    const d = t.date.split(" ")[0];
    if (!byDate[d]) {
      byDate[d] = {
        date: d,
        phhFamilies: 0,
        phhWheat: 0,
        phhRice: 0,
        aayFamilies: 0,
        aayWheat: 0,
        aayRice: 0,
        aaySaree: 0,
        totalWheat: 0,
        totalRice: 0,
        totalTransactions: 0,
      };
    }

    byDate[d].totalWheat += t.wheat;
    byDate[d].totalRice += t.rice;
    byDate[d].totalTransactions += 1;

    if (t.scheme === "PHH") {
      byDate[d].phhWheat += t.wheat;
      byDate[d].phhRice += t.rice;
      byDate[d].phhFamilies += 1;
    } else {
      byDate[d].aayWheat += t.wheat;
      byDate[d].aayRice += t.rice;
      byDate[d].aaySaree += t.saree;
      if (t.wheat > 0) byDate[d].aayFamilies += 1;
    }
  });

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function calculateChartData(transactions: Transaction[]): ChartDataPoint[] {
  const byDate: Record<string, ChartDataPoint> = {};

  transactions.forEach((t) => {
    const d = t.date.split(" ")[0];
    if (!byDate[d]) byDate[d] = { date: d, wheat: 0, rice: 0, phh: 0, aay: 0 };
    byDate[d].wheat += t.wheat;
    byDate[d].rice += t.rice;
    if (t.scheme === "PHH") byDate[d].phh++;
    else if (t.wheat > 0) byDate[d].aay++;
  });

  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, date: d.date.slice(5) }));
}

export function deduplicateTransactions(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const existingIds = new Set(existing.map((t) => t.receiptNo));
  const newTxns = incoming.filter((t) => !existingIds.has(t.receiptNo));
  return [...existing, ...newTxns];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

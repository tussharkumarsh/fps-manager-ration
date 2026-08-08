export interface Customer {
  srcNo: string;
  name: string;
  lastDispatched?: string;
  scheme?: "PHH" | "AAY";
  // Enrichment fields from the government "FPS Beneficiary Detail" export
  // (Ration Card No. in that file === srcNo here).
  areaType?: string;
  status?: string;
  memberCount?: number;
  mobile?: string;
  familyHead?: string;
}

export interface Transaction {
  id: string;
  slNo: number;
  srcNo: string;
  scheme: "PHH" | "AAY";
  availType: "Authenticated" | "OTP" | "IRIS";
  receiptNo: string;
  date: string;
  wheat: number;
  rice: number;
  saree: number;
  amount: number;
  portability: string;
  authTransTime?: string;
  customerName?: string;
  monthDate?: string;
}

export interface FPSSettings {
  distCode: string;
  fpsId: string;
  month: string;
  year: string;
  fpsName?: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  month: string;
  year: string;
  transactionCount: number;
  status: "success" | "error";
  message?: string;
}

export interface DailySummary {
  date: string;
  phhFamilies: number;
  phhWheat: number;
  phhRice: number;
  aayFamilies: number;
  aayWheat: number;
  aayRice: number;
  aaySaree: number;
  totalWheat: number;
  totalRice: number;
  totalTransactions: number;
}

export interface MonthlyStats {
  totalWheat: number;
  totalRice: number;
  totalSaree: number;
  phhCount: number;
  aayCount: number;
  uniqueCustomers: number;
  authCount: number;
  otpCount: number;
  irisCount: number;
  portabilityCount: number;
  activeDays: number;
  totalTransactions: number;
}

export interface ChartDataPoint {
  date: string;
  wheat: number;
  rice: number;
  phh: number;
  aay: number;
}

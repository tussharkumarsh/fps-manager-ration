export interface FamilyMember {
  msNo: number;
  nameEng: string;
  nameLL?: string;
  hofn?: string;
  memberId?: string;
  age?: string;
  uid?: string;
  mobile?: string;
  relation?: string;
  motherName?: string;
  fatherName?: string;
  gender?: string;
}

export interface Customer {
  srcNo: string;
  name: string;
  lastDispatched?: string;
  scheme?: "PHH" | "AAY";
  // Enrichment fields from the government "FPS Beneficiary Detail" export
  // (Ration Card No. in that file === srcNo here).
  sNo?: number;
  areaType?: string;
  status?: string;
  memberCount?: number;
  mobile?: string;
  familyHead?: string;
  members?: FamilyMember[];
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

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  txField: "wheat" | "rice" | "";
  active: boolean;
}

export interface InventoryLedgerEntry {
  fpsId: string;
  year: string;
  month: string;
  itemId: string;
  opening: number;
  received: number;
  distributed: number;
  closing: number;
}

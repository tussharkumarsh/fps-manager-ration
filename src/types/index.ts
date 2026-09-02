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
  // Manually disabled (moved to another shop, deceased, stopped collecting, etc.)
  // — hidden everywhere by default; only Customer Master can opt to show them.
  disabled?: boolean;
  disabledReason?: string;
  disabledAt?: string;
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
  sugar: number;
  saree: number;
  jowar: number;
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

export interface ScmSyncLog {
  id: string;
  timestamp: string;
  month: string;
  year: string;
  roCount: number;
  truckChitCount: number;
  status: "success" | "error";
  message?: string;
}

export interface DailySummary {
  date: string;
  phhFamilies: number;
  phhWheat: number;
  phhRice: number;
  phhSugar: number;
  phhJowar: number;
  aayFamilies: number;
  aayWheat: number;
  aayRice: number;
  aaySugar: number;
  aaySaree: number;
  aayJowar: number;
  totalWheat: number;
  totalRice: number;
  totalSugar: number;
  totalJowar: number;
  totalTransactions: number;
}

export interface MonthlyStats {
  totalWheat: number;
  totalRice: number;
  totalSugar: number;
  totalSaree: number;
  totalJowar: number;
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
  sugar: number;
  jowar: number;
  phh: number;
  aay: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  txField: "wheat" | "rice" | "sugar" | "jowar" | "";
  active: boolean;
}

export interface InventoryLedgerEntry {
  fpsId: string;
  year: string;
  month: string;
  itemId: string;
  received: number;
  distributed: number;
  closing: number;
}

export interface GovStockRegisterEntry {
  fpsId: string;
  year: string;
  month: string;
  commodity: string;
  unit: string;
  alloted: number;
  opening: number;
  receivedRegular: number;
  receivedExtra: number;
  receivedMoved: number;
  issued: number;
  closing: number;
  fetchedAt: string;
}

import type { Customer, Transaction } from "@/types";

export interface AppUser {
  fpsId: string;
  distCode: string;
  username: string;
  passwordHash: string;
  displayName: string;
  role: "dealer" | "admin";
  createdAt: string;
  active: boolean;
}

export interface MonthLock {
  fpsId: string;
  year: string;
  month: string;
  status: "live" | "synced_locked";
  lastSyncedAt: string;
  recordCount: number;
}

export interface StoredTransaction extends Transaction {
  fpsId: string;
  year: string;
  month: string;
  fetchedAt: string;
  source: "api" | "manual";
}

export interface StoredCustomer extends Customer {
  fpsId: string;
}

export interface IUserRepository {
  findByFpsId(fpsId: string): Promise<AppUser | null>;
  upsert(user: AppUser): Promise<void>;
}

export interface ITransactionRepository {
  getForMonth(fpsId: string, year: string, month: string): Promise<StoredTransaction[]>;
  getAll(fpsId: string): Promise<StoredTransaction[]>;
  upsertMany(
    fpsId: string,
    year: string,
    month: string,
    txns: Transaction[],
    source?: "api" | "manual"
  ): Promise<number>;
}

export interface IMonthLockRepository {
  get(fpsId: string, year: string, month: string): Promise<MonthLock | null>;
  upsert(lock: MonthLock): Promise<void>;
}

export interface ICustomerRepository {
  getAll(fpsId: string): Promise<Customer[]>;
  upsertMany(fpsId: string, customers: Customer[]): Promise<number>;
  add(fpsId: string, customer: Customer): Promise<void>;
  remove(fpsId: string, srcNo: string): Promise<void>;
}

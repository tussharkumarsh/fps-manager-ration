import { BlobCustomerRepository } from "@/server/repositories/blob/BlobCustomerRepository";
import type { Customer } from "@/types";

export class TransactionService {
  private customerRepo = new BlobCustomerRepository();

  async getCustomers(fpsId: string): Promise<Customer[]> {
    return this.customerRepo.getAll(fpsId);
  }

  async importCustomers(fpsId: string, customers: Customer[]): Promise<number> {
    return this.customerRepo.upsertMany(fpsId, customers);
  }

  async addCustomer(fpsId: string, customer: Customer): Promise<void> {
    await this.customerRepo.add(fpsId, customer);
  }

  async deleteCustomer(fpsId: string, srcNo: string): Promise<void> {
    await this.customerRepo.remove(fpsId, srcNo);
  }
}

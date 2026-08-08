import { SyncService } from "@/server/services/SyncService";
import { TransactionService } from "@/server/services/TransactionService";

/**
 * "Reset Everything": deletes every transaction, month lock, and customer
 * stored for this dealer. Scoped strictly to fpsId (always the caller's
 * own session) — each dealer's data lives in its own blob file
 * (data/{fps_id}.xlsx), so this can never touch another dealer's data,
 * current or future multi-user ones alike.
 *
 * Delegates to SyncService/TransactionService (rather than writing the
 * blob directly) so their own atomic clears run and, importantly, so
 * SyncService's in-memory read cache gets invalidated — a direct low-level
 * write here would leave that cache serving stale data for up to its TTL.
 */
export class DataResetService {
  private syncService = new SyncService();
  private transactionService = new TransactionService();

  async resetAll(fpsId: string): Promise<void> {
    await this.syncService.clearAllTransactions(fpsId);
    await this.transactionService.clearAllCustomers(fpsId);
  }
}

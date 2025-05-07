import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";

// Updated to align with schema.ts for pending_pool_transactions
export type PendingPoolTransaction = {
  _id: any; // Convex.Id<"pending_pool_transactions">
  provider: string; 
  tx_type: string; // Was transactionType, maps to schema's tx_type
  token: string; 
  amount: number;
  status: string; // Schema uses v.string(), allowing flexibility
  chain_tx_id?: string; // Was onChainTxId
  payload?: any; 
  error?: string; // Was errorMessage
  retry_count?: number; // Was retries. Schema has retry_count: v.number()
  timestamp: number; // Schema's creation timestamp for the pending tx
  // _creationTime will also exist, but schema defines `timestamp`
};

/**
 * Scheduled job to check the status of submitted pool transactions.
 */
export const checkPoolTransactions = internalMutation({
  handler: async (ctx) => {
    const pendingTxs = await ctx.db
      .query("pending_pool_transactions")
      .withIndex("by_status", (q) => q.eq("status", "Submitted")) // Assumes "Submitted" is a valid status
      .collect();

    for (const tx of pendingTxs as any[] as PendingPoolTransaction[]) { // Using any[] as intermediate for TS satisfaction
      if (!tx.chain_tx_id) { // Updated field name
        console.warn("Transaction " + tx._id + " is Submitted but has no chain_tx_id. Skipping.");
        continue;
      }

      const mockStatus = await ctx.runQuery(api.mocks.mockGetBlockchainTransactionStatus, { 
        onChainTxId: tx.chain_tx_id // Updated field name
      });

      if (mockStatus === "Confirmed" || mockStatus === "Failed") {
        await ctx.runMutation(internal.poolTransactionWatcher.processPendingPoolTransactionResult, {
          pendingPoolTxId: tx._id,
          newStatus: mockStatus,
          onChainTxId: tx.chain_tx_id, // Pass the correct field
          errorMessage: mockStatus === "Failed" ? "Transaction failed on-chain (mock)" : undefined,
        });
      }
    }
  },
});

/**
 * Processes the result of a blockchain transaction status check.
 */
export const processPendingPoolTransactionResult = internalMutation({
  args: {
    pendingPoolTxId: v.id("pending_pool_transactions"),
    newStatus: v.union(v.literal("Confirmed"), v.literal("Failed")), // These should match status string values
    onChainTxId: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { pendingPoolTxId, newStatus, onChainTxId, errorMessage }) => {
    const pendingTx: PendingPoolTransaction | null = await ctx.db.get(pendingPoolTxId) as any;

    if (!pendingTx) {
      console.error("Pending pool transaction not found: " + pendingPoolTxId);
      return;
    }

    if (pendingTx.status === "Confirmed" || pendingTx.status === "Failed") {
      console.log("Transaction " + pendingPoolTxId + " already processed. Status: " + pendingTx.status);
      return;
    }

    await ctx.db.patch(pendingPoolTxId, {
      status: newStatus,
      error: errorMessage ?? undefined, // Updated field name to `error`
      last_checked: Date.now(), // From schema for pending_pool_transactions
    });

    console.log("Updated pending_pool_transactions " + pendingPoolTxId + " to status: " + newStatus);

    if (newStatus === "Confirmed") {
      // Prepare data matching schema for finalizeConfirmedPoolTransaction's validator
      const finalizerData = {
        _id: pendingTx._id,
        provider: pendingTx.provider,
        tx_type: pendingTx.tx_type, // Use tx_type from pendingTx
        token: pendingTx.token,
        amount: pendingTx.amount,
        status: newStatus, // This is "Confirmed"
        chain_tx_id: onChainTxId, //This is the one checked
        payload: pendingTx.payload,
        timestamp: pendingTx.timestamp, // Pass creation timestamp of pending tx
        // No error or retry_count needed for confirmed path in finalizer if it's clean
      };
      await ctx.runMutation(internal.liquidityPool.finalizeConfirmedPoolTransaction, {
        pendingPoolTxData: finalizerData as any, // Cast to any if types are still misaligned during transition
      });
    } else if (newStatus === "Failed") {
      console.error(
        "Pool transaction " + pendingTx._id + " (onChainId: " + onChainTxId + ") failed: " + (errorMessage || "No error message provided.")
      );
    }
  },
}); 
import { internalMutation, query, action, internalAction, internalQuery, MutationCtx, QueryCtx, ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";
import { TransactionType, TransactionStatus } from "./types";

export const createPendingPoolTransaction = internalMutation({
  args: {
    provider: v.string(),
    tx_id: v.string(),
    tx_type: v.string(),
    amount: v.number(),
    token: v.string(),
    timestamp: v.number(),
    payload: v.any(),
    status: v.string(),
    retry_count: v.number(),
    policy_id: v.optional(v.id("policies")),
    error: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    // Create the pending transaction record
    return await ctx.db.insert("pending_pool_transactions", {
      provider: args.provider,
      tx_id: args.tx_id,
      tx_type: args.tx_type,
      amount: args.amount,
      token: args.token,
      timestamp: args.timestamp,
      payload: args.payload,
      status: args.status,
      retry_count: args.retry_count,
      policy_id: args.policy_id,
      error: args.error,
    });
  },
});

// Helper internalMutation to log generic pool transactions (if not already existing)
// This is a simplified version. A more robust one might take more specific typed args.
export const logGenericPoolTransaction = internalMutation({
    args: {
        tx_id: v.string(),
        provider: v.string(),
        tx_type: v.string(), 
        amount: v.number(),
        token: v.string(),
        timestamp: v.number(),
        status: v.string(), 
        policy_id: v.optional(v.id("policies")),
        chain_tx_id: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.any()),
    },
    handler: async (ctx: MutationCtx, args) => {
        return await ctx.db.insert("pool_transactions", args);
    },
});

// CV-LP-215: Implement getTransactionsByProvider query
export const getTransactionsByProvider = query({
  args: {
    provider: v.string(), 
    token: v.optional(v.string()),
    tx_type: v.optional(v.string()), 
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, { provider, token, tx_type, limit }) => {
    let queryBuilder = ctx.db
      .query("pool_transactions") 
      .withIndex("by_provider_timestamp", (q) => q.eq("provider", provider))
      .order("desc");

    const allTransactions = await queryBuilder.collect() as any[]; 
    let filteredTransactions = allTransactions;

    if (token) {
      filteredTransactions = filteredTransactions.filter(tx => tx.token === token);
    }
    if (tx_type) {
      filteredTransactions = filteredTransactions.filter(tx => tx.tx_type === tx_type);
    }

    if (limit) {
      return filteredTransactions.slice(0, limit);
    }
    return filteredTransactions;
  }
});

// CV-LP-216: Implement getPoolTransactions query (for admins)
export const getPoolTransactions = query({
  args: {
    token: v.optional(v.string()),
    tx_type: v.optional(v.string()),
    status: v.optional(v.string()),
    provider: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const roles = (identity as any).roles; 
    const isAdmin = Array.isArray(roles) && roles.includes("admin");
    if (!isAdmin) {
      throw new Error("Admin access required.");
    }

    let queryBuilder = ctx.db.query("pool_transactions");

    if (args.token) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("token"), args.token!));
    }
    if (args.tx_type) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("tx_type"), args.tx_type!));
    }
    if (args.status) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("status"), args.status!));
    }
    if (args.provider) {
      queryBuilder = queryBuilder.filter(q => q.eq(q.field("provider"), args.provider!));
    }
    if (args.startDate !== undefined) {
      queryBuilder = queryBuilder.filter(q => q.gte(q.field("timestamp"), args.startDate!));
    }
    if (args.endDate !== undefined) {
      queryBuilder = queryBuilder.filter(q => q.lte(q.field("timestamp"), args.endDate!));
    }
    
    const allMatchingTransactions = await queryBuilder.collect();
    const totalCount = allMatchingTransactions.length;

    const sortedTransactions = allMatchingTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    const limit = args.limit ?? 10;
    const offset = args.offset ?? 0;

    const paginatedTransactions = sortedTransactions.slice(offset, offset + limit);

    return {
      transactions: paginatedTransactions,
      totalCount,
    };
  },
});

interface ProcessBlockchainTransactionResult {
  success: boolean;
  processedChainTxId?: string;
  finalStatus?: string;
  error?: string;
}

export const processBlockchainTransaction = internalAction({
  args: {
    pendingTxConvexId: v.id("pending_pool_transactions"),
    chainTxId: v.string(),
    outcomeStatus: v.union(v.literal("CONFIRMED"), v.literal("FAILED")),
    blockHeight: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<ProcessBlockchainTransactionResult> => {
    console.log(`Processing blockchain transaction: ${args.chainTxId} for pending ID: ${args.pendingTxConvexId}, Status: ${args.outcomeStatus}`);

    const updatedPendingTx: Doc<"pending_pool_transactions"> | null = await ctx.runMutation(internal.liquidityPool.transactionManager.updatePendingPoolTransactionOutcome, {
      pendingTxConvexId: args.pendingTxConvexId,
      chainTxId: args.chainTxId,
      outcomeStatus: args.outcomeStatus,
      blockHeight: args.blockHeight,
      errorMessage: args.errorMessage,
    });

    if (!updatedPendingTx) {
      console.error(`Failed to update or find pending pool transaction: ${args.pendingTxConvexId}. Aborting further processing for ${args.chainTxId}.`);
      return { success: false, error: "Pending transaction not found or update failed." };
    }

    if (updatedPendingTx.status !== "CONFIRMED" && updatedPendingTx.status !== "FAILED") {
        console.warn(`Pending transaction ${updatedPendingTx._id} has an unexpected status '${updatedPendingTx.status}' after outcome update. This might indicate it was already processed or an issue with updatePendingPoolTransactionOutcome return type.`);
        return { success: false, error: `Unexpected status: ${updatedPendingTx.status}`, finalStatus: updatedPendingTx.status };
    }

    if (updatedPendingTx.status === "CONFIRMED") {
      const finalizeArgs = {
        _id: updatedPendingTx._id,
        provider: updatedPendingTx.provider,
        tx_type: updatedPendingTx.tx_type,
        token: updatedPendingTx.token,
        amount: updatedPendingTx.amount,
        status: "Confirmed" as const, 
        chain_tx_id: updatedPendingTx.chain_tx_id,
        payload: updatedPendingTx.payload,
        timestamp: updatedPendingTx.timestamp,
      };
      await ctx.runMutation(internal.liquidityPool.transactionManager.finalizeConfirmedPoolTransaction, { 
         pendingPoolTxData: finalizeArgs as any 
      });
      console.log(`Successfully triggered finalization for confirmed pending transaction: ${updatedPendingTx._id}`);
    } else if (updatedPendingTx.status === "FAILED") {
      await ctx.runMutation(internal.liquidityPool.transactionManager.revertFailedPendingPoolTransaction, { 
        pendingTxData: updatedPendingTx 
      });
      console.log(`Successfully triggered reversion for failed pending transaction: ${updatedPendingTx._id}`);
    }
    
    if (updatedPendingTx.token) {
        await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, { 
            token: updatedPendingTx.token,
        });
        console.log(`Scheduled pool metrics update for token: ${updatedPendingTx.token}`);
    }

    return { success: true, processedChainTxId: args.chainTxId, finalStatus: updatedPendingTx.status };
  },
});

export const updatePendingPoolTransactionOutcome = internalMutation({
  args: {
    pendingTxConvexId: v.id("pending_pool_transactions"),
    chainTxId: v.string(),
    outcomeStatus: v.union(v.literal("CONFIRMED"), v.literal("FAILED")),
    blockHeight: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args): Promise<Doc<"pending_pool_transactions"> | null> => {
    const pendingTx = await ctx.db.get(args.pendingTxConvexId);
    if (!pendingTx) {
      console.error(`Pending pool transaction not found: ${args.pendingTxConvexId}`);
      return null;
    }

    if (pendingTx.status === "Processed" || 
        (pendingTx.status === args.outcomeStatus && pendingTx.chain_tx_id === args.chainTxId)) {
      console.warn(`Pending transaction ${args.pendingTxConvexId} (ChainTx: ${pendingTx.chain_tx_id}) is already in status '${pendingTx.status}'. Current event (ChainTx: ${args.chainTxId}, Status: ${args.outcomeStatus}). Assuming already processed or duplicate event.`);
      return pendingTx as Doc<"pending_pool_transactions">;
    }
    if ((pendingTx.status === "CONFIRMED" || pendingTx.status === "FAILED") && pendingTx.chain_tx_id !== args.chainTxId) {
        console.error(`Critical: Pending transaction ${args.pendingTxConvexId} already has outcome ${pendingTx.status} for chainTxId ${pendingTx.chain_tx_id}, but received new outcome for ${args.chainTxId}.`);
        return pendingTx as Doc<"pending_pool_transactions">;
    }

    await ctx.db.patch(args.pendingTxConvexId, {
      status: args.outcomeStatus,
      chain_tx_id: args.chainTxId,
      block_height: args.blockHeight,
      error: args.errorMessage,
      last_checked: Date.now(),
    });
    
    const updatedDoc = await ctx.db.get(args.pendingTxConvexId);
     if (!updatedDoc) {
        console.error(`Failed to retrieve pending pool transaction ${args.pendingTxConvexId} after patch.`);
        return null;
    }
    return updatedDoc as Doc<"pending_pool_transactions">;
  },
});

export const revertFailedPendingPoolTransaction = internalMutation({
  args: { pendingTxData: v.any() },
  handler: async (ctx: MutationCtx, args) => {
    const { provider, tx_type, token, amount, _id: pendingTxId, chain_tx_id, error: txError, timestamp: creationTimestamp } = args.pendingTxData as Doc<"pending_pool_transactions"> & { error?: string };
    
    console.log(`Reverting failed pending transaction: ${pendingTxId} (ChainTx: ${chain_tx_id}), Type: ${tx_type}`);

    await ctx.db.insert("pool_transactions", {
      provider,
      tx_id: pendingTxId.toString(), 
      tx_type,
      amount,
      token,
      timestamp: Date.now(), 
      status: "FAILED",
      chain_tx_id: chain_tx_id,
      description: `Failed ${tx_type} of ${amount} ${token}. Error: ${txError || 'Unknown error'}`,
      metadata: { pending_tx_creation_timestamp: creationTimestamp }
    });

    if (tx_type === TransactionType.WITHDRAWAL || tx_type === "WITHDRAWAL_CAPITAL") {
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => q.eq(q.field("provider"), provider) && q.eq(q.field("token"), token))
        .unique();
      if (balance && typeof balance.available_balance === 'number' && typeof amount === 'number') {
        await ctx.db.patch(balance._id, {
          available_balance: balance.available_balance + amount,
          last_updated: Date.now(),
        });
        console.log(`Reverted available balance for ${provider}, token ${token}, amount ${amount}`);
      } else {
        console.warn(`Could not revert capital withdrawal for ${provider}, token ${token}: balance not found or invalid amount/balance.`);
      }
    } else if (tx_type === TransactionType.PREMIUM || tx_type === "WITHDRAWAL_PREMIUM") {
       const balance = await ctx.db
        .query("provider_balances")
        .filter(q => q.eq(q.field("provider"), provider) && q.eq(q.field("token"), token))
        .unique();
      if (balance && typeof balance.pending_premiums === 'number' && typeof amount === 'number') {
         await ctx.db.patch(balance._id, {
          pending_premiums: Math.max(0, balance.pending_premiums - amount),
          last_updated: Date.now(),
        });
        console.log(`Reverted pending premiums for ${provider}, token ${token}, amount ${amount}`);
      } else {
         console.warn(`Could not revert premium withdrawal for ${provider}, token ${token}: balance not found or invalid amount/balance.`);
      }
    }
    
    return { reverted: true, pendingTxId };
  },
});

export const getPendingPoolTransactionDetails = internalQuery({
  args: { pendingTxConvexId: v.id("pending_pool_transactions") },
  handler: async (ctx: QueryCtx, args): Promise<Doc<"pending_pool_transactions"> | null> => {
    return await ctx.db.get(args.pendingTxConvexId);
  },
});

interface CheckTransactionStatusResult {
  success: boolean;
  status?: string; 
  message: string;
  processed?: boolean; 
}

export const checkTransactionStatus = action({
  args: {
    pendingTxConvexId: v.id("pending_pool_transactions"),
  },
  handler: async (ctx: ActionCtx, args): Promise<CheckTransactionStatusResult> => {
    console.log(`Checking status for pending pool transaction ID: ${args.pendingTxConvexId}`);

    const pendingTx = await ctx.runQuery(internal.liquidityPool.transactionManager.getPendingPoolTransactionDetails, { 
      pendingTxConvexId: args.pendingTxConvexId 
    });

    if (!pendingTx) {
      return { success: false, message: "Pending transaction not found." };
    }

    if (pendingTx.status === "CONFIRMED" || pendingTx.status === "FAILED" || pendingTx.status === "Processed") {
      return { success: true, status: pendingTx.status, message: "Transaction already in a terminal state." };
    }

    if (!pendingTx.chain_tx_id) {
      return { success: false, status: pendingTx.status, message: "Transaction does not have a chain_tx_id to check." };
    }

    if (pendingTx.status !== "SUBMITTED" && pendingTx.status !== "PENDING") { 
        console.warn(`Checking status for transaction ${pendingTx._id} with status ${pendingTx.status}, which might not be appropriate for on-chain status check.`);
    }

    const randomOutcome = Math.random();
    let simulatedOnChainStatus: { status: "CONFIRMED" | "FAILED" | "PENDING_ON_CHAIN", blockHeight?: number, errorDetails?: string };

    if (randomOutcome < 0.6) { 
      simulatedOnChainStatus = { status: "CONFIRMED", blockHeight: 12345 };
    } else if (randomOutcome < 0.8) { 
      simulatedOnChainStatus = { status: "FAILED", errorDetails: "Simulated transaction failure: Out of gas." };
    } else { 
      simulatedOnChainStatus = { status: "PENDING_ON_CHAIN" };
    }
    console.log(`Simulated on-chain status for ${pendingTx.chain_tx_id}: ${simulatedOnChainStatus.status}`);

    let processed = false;
    if (simulatedOnChainStatus.status === "CONFIRMED") {
      await ctx.runAction(internal.liquidityPool.transactionManager.processBlockchainTransaction, { 
        pendingTxConvexId: pendingTx._id,
        chainTxId: pendingTx.chain_tx_id, 
        outcomeStatus: "CONFIRMED",
        blockHeight: simulatedOnChainStatus.blockHeight,
      });
      processed = true;
      return { success: true, status: "CONFIRMED", message: "Transaction confirmed and processed.", processed };
    } else if (simulatedOnChainStatus.status === "FAILED") {
      await ctx.runAction(internal.liquidityPool.transactionManager.processBlockchainTransaction, { 
        pendingTxConvexId: pendingTx._id,
        chainTxId: pendingTx.chain_tx_id,
        outcomeStatus: "FAILED",
        errorMessage: simulatedOnChainStatus.errorDetails,
      });
      processed = true;
      return { success: true, status: "FAILED", message: "Transaction failed and processed.", processed };
    } else { 
      return { success: true, status: "PENDING_ON_CHAIN", message: "Transaction is still pending on-chain.", processed };
    }
  },
});

const pendingPoolTxDataValidator = v.object({
  _id: v.id("pending_pool_transactions"),
  provider: v.string(),
  tx_type: v.string(), 
  token: v.string(),
  amount: v.number(),
  status: v.literal("Confirmed"), 
  chain_tx_id: v.optional(v.string()), 
  payload: v.optional(v.any()), 
  timestamp: v.number(), 
});

export const finalizeConfirmedPoolTransaction = internalMutation({
  args: { pendingPoolTxData: pendingPoolTxDataValidator },
  handler: async (ctx: MutationCtx, { pendingPoolTxData }) => {
    console.log("Finalizing confirmed pool transaction: ", pendingPoolTxData._id);

    const commonTxData = {
      provider: pendingPoolTxData.provider,
      tx_id: pendingPoolTxData._id.toString(), 
      tx_type: pendingPoolTxData.tx_type, 
      amount: pendingPoolTxData.amount,
      token: pendingPoolTxData.token,
      timestamp: Date.now(), 
      status: "Confirmed", 
      chain_tx_id: pendingPoolTxData.chain_tx_id,
      policy_id: pendingPoolTxData.payload?.policy_id, 
      description: `Finalized: ${pendingPoolTxData.tx_type} of ${pendingPoolTxData.amount} ${pendingPoolTxData.token}`,
      metadata: { pending_tx_creation_timestamp: pendingPoolTxData.timestamp }
    };

    const historicalTxId = await ctx.db.insert("pool_transactions", commonTxData as any);
    console.log("Created pool_transaction: ", historicalTxId, " for pending tx: ", pendingPoolTxData._id);

    let specificArgs: any;
    switch (pendingPoolTxData.tx_type) {
      case "DEPOSIT_CAPITAL": 
        specificArgs = { 
          provider: pendingPoolTxData.provider,
          token: pendingPoolTxData.token,
          amount: pendingPoolTxData.amount,
          providerTxId: historicalTxId, 
        };
        await ctx.runMutation(internal.liquidityPool.transactionManager.recordProviderDepositCompletion, specificArgs);
        break;
      case "WITHDRAWAL_CAPITAL": 
        specificArgs = { 
          provider: pendingPoolTxData.provider,
          token: pendingPoolTxData.token,
          amount: pendingPoolTxData.amount,
          providerTxId: historicalTxId,
        };
        await ctx.runMutation(internal.liquidityPool.transactionManager.recordProviderWithdrawalCompletion, specificArgs);
        break;
      case "WITHDRAWAL_PREMIUM": 
        specificArgs = {
          provider: pendingPoolTxData.provider,
          token: pendingPoolTxData.token,
          amount: pendingPoolTxData.amount,
          providerTxId: historicalTxId,
        };
        await ctx.runMutation(internal.liquidityPool.transactionManager.recordProviderPremiumWithdrawalCompletion, specificArgs);
        break;
      default:
        console.error("Unknown tx_type in finalizeConfirmedPoolTransaction: ", pendingPoolTxData.tx_type);
        await ctx.db.patch(pendingPoolTxData._id, { status: "ErrorInFinalization", error: `Unknown tx_type: ${pendingPoolTxData.tx_type}` } as any);
        return;
    }
    await ctx.db.patch(pendingPoolTxData._id, { status: "Processed" } as any);
    console.log("Successfully finalized and marked as Processed: ", pendingPoolTxData._id);
  }
});

export const recordProviderDepositCompletion = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amount: v.number(),
    providerTxId: v.id("pool_transactions"), 
  },
  handler: async (ctx: MutationCtx, { provider, token, amount }) => {
    let balance = await ctx.db.query("provider_balances")
      .withIndex("by_provider_token", (q) => q.eq("provider", provider).eq("token", token))
      .unique();

    if (balance) {
      await ctx.db.patch(balance._id, {
        total_deposited: (balance.total_deposited || 0) + amount,
        available_balance: (balance.available_balance || 0) + amount,
        last_updated: Date.now(),
      });
    } else {
      await ctx.db.insert("provider_balances", {
        provider,
        token,
        total_deposited: amount,
        available_balance: amount,
        locked_balance: 0,
        earned_premiums: 0,
        withdrawn_premiums: 0,
        pending_premiums: 0,
        last_updated: Date.now(),
      } as any);
    }
    console.log("Completed deposit for ", provider, " Token: ", token, " Amount: ", amount);
  }
});

export const recordProviderWithdrawalCompletion = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amount: v.number(),
    providerTxId: v.id("pool_transactions"), 
  },
  handler: async (ctx: MutationCtx, { provider, token, amount }) => {
    const balance = await ctx.db.query("provider_balances")
      .withIndex("by_provider_token", (q) => q.eq("provider", provider).eq("token", token))
      .unique();

    if (!balance || (balance.available_balance || 0) < amount) {
      console.error("CRITICAL: Insufficient available balance for withdrawal completion for ", provider, token, amount);
      return; 
    }

    await ctx.db.patch(balance._id, {
      available_balance: (balance.available_balance || 0) - amount,
      last_updated: Date.now(),
    });
    console.log("Completed withdrawal for ", provider, " Token: ", token, " Amount: ", amount);
  }
});

export const recordProviderPremiumWithdrawalCompletion = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amount: v.number(),
    providerTxId: v.id("pool_transactions"), 
  },
  handler: async (ctx: MutationCtx, { provider, token, amount }) => {
    const balance = await ctx.db.query("provider_balances")
      .withIndex("by_provider_token", (q) => q.eq("provider", provider).eq("token", token))
      .unique();

    if (!balance || (balance.earned_premiums || 0) < amount) { 
      console.error("CRITICAL: Insufficient earned_premiums for withdrawal completion for ", provider, token, amount);
      return;
    }

    await ctx.db.patch(balance._id, {
      earned_premiums: (balance.earned_premiums || 0) - amount,
      withdrawn_premiums: (balance.withdrawn_premiums || 0) + amount,
      last_updated: Date.now(),
    });
    console.log("Completed premium withdrawal for ", provider, " Token: ", token, " Amount: ", amount);
  }
});

export const incrementPendingTxRetryCount = internalMutation({
  args: {
    pendingTxConvexId: v.id("pending_pool_transactions"),
    newPayloadForRetry: v.optional(v.any()), 
  },
  handler: async (ctx: MutationCtx, args) => {
    const pendingTx = await ctx.db.get(args.pendingTxConvexId);
    if (!pendingTx) {
      console.error(`Pending transaction not found for retry increment: ${args.pendingTxConvexId}`);
      return null;
    }
    await ctx.db.patch(args.pendingTxConvexId, {
      retry_count: (pendingTx.retry_count || 0) + 1,
      status: "PENDING", 
      chain_tx_id: undefined, 
      error: undefined, 
      last_attempted_at: Date.now(), 
      last_checked: undefined, 
      payload: args.newPayloadForRetry !== undefined ? args.newPayloadForRetry : pendingTx.payload, 
    });
    return await ctx.db.get(args.pendingTxConvexId);
  },
});

interface RetryTransactionResult {
  success: boolean;
  message: string;
  newTransactionOptions?: any; 
  pendingTxId?: Id<"pending_pool_transactions">;
}

const MAX_TRANSACTION_RETRIES = 3;

export const retryTransaction = action({
  args: {
    pendingTxConvexId: v.id("pending_pool_transactions"),
  },
  handler: async (ctx: ActionCtx, args): Promise<RetryTransactionResult> => {
    console.log(`Attempting to retry transaction: ${args.pendingTxConvexId}`);

    const pendingTx = await ctx.runQuery(internal.liquidityPool.transactionManager.getPendingPoolTransactionDetails, { 
      pendingTxConvexId: args.pendingTxConvexId,
    });

    if (!pendingTx) {
      return { success: false, message: "Pending transaction not found." };
    }

    if (pendingTx.status !== "FAILED") {
      return { success: false, message: `Transaction status is '${pendingTx.status}', not 'FAILED'. Retry not applicable.` };
    }

    if ((pendingTx.retry_count || 0) >= MAX_TRANSACTION_RETRIES) {
      return { 
        success: false, 
        message: `Maximum retry limit (${MAX_TRANSACTION_RETRIES}) reached for transaction ${pendingTx._id}.` 
      };
    }

    let newTransactionOptions: any;
    let newPayloadForRetry: any = pendingTx.payload; 

    try {
      switch (pendingTx.tx_type) {
        case TransactionType.DEPOSIT: 
        case "DEPOSIT_CAPITAL": 
          console.log(`Simulating regeneration of DEPOSIT transaction for ${pendingTx._id}`);
          return { success: false, message: `Retry logic for ${pendingTx.tx_type} not fully implemented yet. Requires re-preparation of transaction.` };

        case TransactionType.WITHDRAWAL:
        case "WITHDRAWAL_CAPITAL":
          console.log(`Simulating regeneration of WITHDRAWAL transaction for ${pendingTx._id}`);
          return { success: false, message: `Retry logic for ${pendingTx.tx_type} not fully implemented yet. Requires re-preparation of transaction.` };

        case TransactionType.PREMIUM:
        case "WITHDRAWAL_PREMIUM":
          console.log(`Simulating regeneration of PREMIUM transaction for ${pendingTx._id}`);
          return { success: false, message: `Retry logic for ${pendingTx.tx_type} not fully implemented yet. Requires re-preparation of transaction.` };

        default:
          return { success: false, message: `Retry not supported for transaction type: ${pendingTx.tx_type}` };
      }
    } catch (error: any) {
        console.error(`Error during transaction re-preparation for ${pendingTx._id}:`, error);
        return { success: false, message: `Failed to re-prepare transaction: ${error.message}` };
    }
  },
}); 
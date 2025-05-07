import { query, mutation, action, internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { TransactionType, TransactionStatus } from "./types";
import type { PreparedStxTransferResult } from "../blockchainPreparation";

interface CheckWithdrawalEligibilityResult {
  eligible: boolean;
  reason?: string;
  balance?: {
    availableBalance: number;
    lockedBalance: number;
    pendingPremiums: number;
  };
  maxWithdrawal?: number;
  pendingWithdrawals?: number;
  suggestClaimPremiums?: boolean;
  pendingPremiums?: number;
}

/**
 * Check if a provider is eligible to withdraw the requested amount.
 * Validates available balance and any pending operations.
 * 
 * @param token Token to withdraw
 * @param amount Amount to withdraw
 * @returns Eligibility object with result and reason
 */
export const checkWithdrawalEligibility = internalQuery({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx: QueryCtx, args): Promise<CheckWithdrawalEligibilityResult> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        eligible: false,
        reason: "Authentication required to check withdrawal eligibility",
      };
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Get provider balance for the token
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("token"), args.token)
      )
      .unique();
    
    // Check if the provider has a balance record for this token
    if (!balance) {
      return {
        eligible: false,
        reason: `No balance found for token ${args.token}`,
        balance: {
          availableBalance: 0,
          lockedBalance: 0,
          pendingPremiums: 0,
        },
      };
    }
    
    // Check if amount is positive
    if (args.amount <= 0) {
      return {
        eligible: false,
        reason: "Withdrawal amount must be greater than zero",
        balance: {
          availableBalance: balance.available_balance,
          lockedBalance: balance.locked_balance,
          pendingPremiums: balance.pending_premiums,
        },
      };
    }
    
    // Check if there's enough available balance
    const availableBalance = balance.available_balance;
    if (availableBalance < args.amount) {
      return {
        eligible: false,
        reason: `Insufficient available balance. Available: ${availableBalance}, Requested: ${args.amount}`,
        balance: {
          availableBalance: balance.available_balance,
          lockedBalance: balance.locked_balance,
          pendingPremiums: balance.pending_premiums,
        },
        maxWithdrawal: availableBalance,
      };
    }
    
    // Check if there are any pending withdrawal transactions
    const pendingWithdrawals = await ctx.db
      .query("pending_pool_transactions")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("token"), args.token) &&
        q.eq(q.field("tx_type"), TransactionType.WITHDRAWAL) &&
        q.neq(q.field("status"), TransactionStatus.FAILED) &&
        q.neq(q.field("status"), TransactionStatus.CANCELLED)
      )
      .collect();
    
    // Calculate the total pending withdrawal amount
    const pendingWithdrawalTotal = pendingWithdrawals.reduce(
      (sum, tx) => sum + tx.amount, 0
    );
    
    // Check if there's enough balance after accounting for pending withdrawals
    if (availableBalance - pendingWithdrawalTotal < args.amount) {
      return {
        eligible: false,
        reason: `Insufficient available balance after accounting for pending withdrawals (${pendingWithdrawalTotal})`,
        balance: {
          availableBalance: balance.available_balance,
          lockedBalance: balance.locked_balance,
          pendingPremiums: balance.pending_premiums,
        },
        pendingWithdrawals: pendingWithdrawalTotal,
        maxWithdrawal: availableBalance - pendingWithdrawalTotal,
      };
    }
    
    // Check if there are pending premiums that could be claimed first
    if (balance.pending_premiums > 0) {
      // Still eligible, but we'll suggest claiming premiums first
      return {
        eligible: true,
        suggestClaimPremiums: true,
        pendingPremiums: balance.pending_premiums,
        reason: "Eligible for withdrawal, but there are pending premiums that could be claimed first",
        balance: {
          availableBalance: balance.available_balance,
          lockedBalance: balance.locked_balance,
          pendingPremiums: balance.pending_premiums,
        },
        pendingWithdrawals: pendingWithdrawalTotal,
        maxWithdrawal: availableBalance - pendingWithdrawalTotal,
      };
    }
    
    // All checks passed, provider is eligible to withdraw
    return {
      eligible: true,
      balance: {
        availableBalance: balance.available_balance,
        lockedBalance: balance.locked_balance,
        pendingPremiums: balance.pending_premiums,
      },
      pendingWithdrawals: pendingWithdrawalTotal,
      maxWithdrawal: availableBalance - pendingWithdrawalTotal,
    };
  },
});

interface MaxWithdrawalAmountInfo {
  availableBalance: number;
  pendingWithdrawals: number;
  maxWithdrawal: number;
  pendingPremiums: number;
}

interface GetMaxWithdrawalAmountsResult {
  [token: string]: MaxWithdrawalAmountInfo;
}

/**
 * Get maximum withdrawal amount for each token the provider has.
 * Useful for withdrawal form UI.
 * 
 * @returns Maximum withdrawal amounts by token
 */
export const getMaxWithdrawalAmounts = query({
  handler: async (ctx: QueryCtx): Promise<GetMaxWithdrawalAmountsResult> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to get maximum withdrawal amounts");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Get all balances for this provider
    const balances = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider))
      .collect();
    
    // Get all pending withdrawals for this provider
    const pendingWithdrawals = await ctx.db
      .query("pending_pool_transactions")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("tx_type"), TransactionType.WITHDRAWAL) &&
        q.neq(q.field("status"), TransactionStatus.FAILED) &&
        q.neq(q.field("status"), TransactionStatus.CANCELLED)
      )
      .collect();
    
    // Group pending withdrawals by token
    const pendingByToken: Record<string, number> = {};
    for (const tx of pendingWithdrawals) {
      pendingByToken[tx.token] = (pendingByToken[tx.token] || 0) + tx.amount;
    }
    
    // Calculate max withdrawal amount for each token
    const result: Record<string, MaxWithdrawalAmountInfo> = {};
    
    for (const balance of balances) {
      const token = balance.token;
      const pendingAmount = pendingByToken[token] || 0;
      const maxWithdrawal = Math.max(0, balance.available_balance - pendingAmount);
      
      result[token] = {
        availableBalance: balance.available_balance,
        pendingWithdrawals: pendingAmount,
        maxWithdrawal,
        pendingPremiums: balance.pending_premiums,
      };
    }
    
    return result;
  },
});

// --- Capital Commitment Actions (CV-LP-210) ---

interface RequestCapitalCommitmentResult {
  pendingTxId: Id<"pending_pool_transactions">;
  txId: string;
  transaction: any;
  amount: number;
  token: string;
}

export const requestCapitalCommitment = action({
  args: {
    token: v.string(),
    amount: v.number(),
    tier: v.optional(v.string()),
  },
  handler: async (ctx: ActionCtx, args): Promise<RequestCapitalCommitmentResult> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to commit capital");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Validate input
    if (args.amount <= 0) {
      throw new Error("Deposit amount must be greater than zero");
    }
    
    // Generate a unique transaction ID for tracking
    const txId = `deposit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    let transaction: PreparedStxTransferResult;
    if (args.token === "STX") {
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareStxTransferToLiquidityPool, 
        { 
          amount: args.amount,
          sender: provider,
        }
      );
    } else if (args.token === "sBTC") {
      const sbtcTransaction = await ctx.runAction(
        internal.blockchainPreparation.prepareSbtcTransferToLiquidityPool, 
        { 
          amount: args.amount,
          sender: provider,
        }
      );
      transaction = { txOptions: sbtcTransaction.txOptions, amount: sbtcTransaction.amount, sender: sbtcTransaction.sender, type: 'sBTC' } as any;
    } else {
      throw new Error(`Unsupported token type: ${args.token}`);
    }
    
    // Record the pending transaction in the database
    const pendingTxId: Id<"pending_pool_transactions"> = await ctx.runMutation(
      internal.liquidityPool.transactionManager.createPendingPoolTransaction, 
      {
        provider,
        tx_id: txId,
        tx_type: TransactionType.DEPOSIT,
        amount: args.amount,
        token: args.token,
        timestamp: Date.now(),
        payload: {
          provider,
          amount: args.amount,
          token: args.token,
          tier: args.tier || "balanced",
          transactionDetails: transaction
        },
        status: TransactionStatus.PENDING,
        retry_count: 0,
      }
    );
    
    // Return the pending transaction record and blockchain transaction data
    return {
      pendingTxId,
      txId,
      transaction: transaction.txOptions,
      amount: args.amount,
      token: args.token,
    };
  },
});

/**
 * Confirm a capital commitment after on-chain transaction is confirmed.
 * This can be called directly by the frontend after transaction confirmation
 * or by a background job that checks transaction status.
 */
export const confirmCapitalCommitment = mutation({
  args: {
    pendingTxId: v.id("pending_pool_transactions"),
    chainTxId: v.string(),
    status: v.string(),
    blockHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the pending transaction
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      throw new Error(`Pending transaction not found: ${args.pendingTxId}`);
    }
    
    // Verify this is a deposit transaction
    if (pendingTx.tx_type !== TransactionType.DEPOSIT) {
      throw new Error(`Invalid transaction type: ${pendingTx.tx_type}`);
    }
    
    // Update the pending transaction status
    await ctx.db.patch(args.pendingTxId, {
      status: args.status,
      chain_tx_id: args.chainTxId,
      last_checked: Date.now(),
    });
    
    // If the transaction is confirmed, update the provider's balance
    if (args.status === TransactionStatus.CONFIRMED) {
      // Get the provider's current balance
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), pendingTx.provider) && 
          q.eq(q.field("token"), pendingTx.token)
        )
        .unique();
      
      if (balance) {
        // Update existing balance
        await ctx.db.patch(balance._id, {
          total_deposited: balance.total_deposited + pendingTx.amount,
          available_balance: balance.available_balance + pendingTx.amount,
          last_updated: Date.now(),
        });
      } else {
        // Create new balance record
        await ctx.db.insert("provider_balances", {
          provider: pendingTx.provider,
          token: pendingTx.token,
          total_deposited: pendingTx.amount,
          available_balance: pendingTx.amount,
          locked_balance: 0,
          earned_premiums: 0,
          withdrawn_premiums: 0,
          pending_premiums: 0,
          last_updated: Date.now(),
        });
      }
      
      // Record the transaction in pool_transactions
      await ctx.db.insert("pool_transactions", {
        provider: pendingTx.provider,
        tx_id: pendingTx.tx_id,
        tx_type: pendingTx.tx_type,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: args.status,
        chain_tx_id: args.chainTxId,
        description: `Deposited ${pendingTx.amount} ${pendingTx.token}`,
      });
      
      console.log("[DEBUG] confirmCapitalCommitment: pendingTx.token for updatePoolMetrics:", pendingTx.token);
      // Schedule pool metrics update instead of directly calling runAction
      await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, {
        token: pendingTx.token,
      });
      console.log("[DEBUG] Scheduled updatePoolMetrics in confirmCapitalCommitment");
    }
    
    return {
      status: args.status,
      txId: pendingTx.tx_id,
      chainTxId: args.chainTxId,
    };
  },
});

// --- Withdrawal Actions (CV-LP-211) ---

interface RequestWithdrawalResult {
  pendingTxId: Id<"pending_pool_transactions">;
  txId: string;
  transaction: any; // Blockchain transaction options
  amount: number;
  token: string;
}

export const requestWithdrawal = action({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx: ActionCtx, args): Promise<RequestWithdrawalResult> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to request withdrawal");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Validate input
    if (args.amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
    
    // Check withdrawal eligibility
    const eligibility = await ctx.runQuery(
      internal.liquidityPool.capitalManagement.checkWithdrawalEligibility,
      {
        token: args.token,
        amount: args.amount,
      }
    );
    
    if (!eligibility.eligible) {
      throw new Error(`Withdrawal not eligible: ${eligibility.reason}`);
    }
    
    // Generate a unique transaction ID for tracking
    const txId = `withdraw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Prepare the withdrawal transaction based on token type
    let transaction;
    if (args.token === "STX") {
      // For STX, prepare a withdrawal from the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareStxWithdrawalFromLiquidityPool, 
        { 
          amount: args.amount,
          recipient: provider,
        }
      );
    } else if (args.token === "sBTC") {
      // For sBTC, prepare a SIP-010 token withdrawal from the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareSbtcWithdrawalFromLiquidityPool, 
        { 
          amount: args.amount,
          recipient: provider,
        }
      );
    } else {
      throw new Error(`Unsupported token type: ${args.token}`);
    }
    
    // Record the pending transaction in the database
    const pendingTxId: Id<"pending_pool_transactions"> = await ctx.runMutation(
      internal.liquidityPool.transactionManager.createPendingPoolTransaction, 
      {
        provider,
        tx_id: txId,
        tx_type: TransactionType.WITHDRAWAL,
        amount: args.amount,
        token: args.token,
        timestamp: Date.now(),
        payload: {
          provider,
          amount: args.amount,
          token: args.token,
          transaction,
        },
        status: TransactionStatus.PENDING,
        retry_count: 0,
      }
    );
    
    // Reserve the withdrawal amount
    await ctx.runMutation(
      internal.liquidityPool.capitalManagement.reserveWithdrawalAmount,
      {
        provider,
        token: args.token,
        amount: args.amount,
        pendingTxId,
      }
    );
    
    // Return the pending transaction record and blockchain transaction data
    return {
      pendingTxId,
      txId,
      transaction: transaction.txOptions,
      amount: args.amount,
      token: args.token,
    };
  },
});

/**
 * Reserves withdrawal amount by reducing available balance
 */
export const reserveWithdrawalAmount = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amount: v.number(),
    pendingTxId: v.id("pending_pool_transactions"),
  },
  handler: async (ctx, args) => {
    // Get the provider's current balance
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => 
        q.eq(q.field("provider"), args.provider) && 
        q.eq(q.field("token"), args.token)
      )
      .unique();
    
    if (!balance) {
      throw new Error(`Provider balance not found for token ${args.token}`);
    }
    
    // Verify available balance is sufficient
    if (balance.available_balance < args.amount) {
      throw new Error(`Insufficient available balance: ${balance.available_balance} < ${args.amount}`);
    }
    
    // Update the balance to reserve the withdrawal amount
    await ctx.db.patch(balance._id, {
      available_balance: balance.available_balance - args.amount,
      last_updated: Date.now(),
    });
    
    return {
      provider: args.provider,
      token: args.token,
      amount: args.amount,
      reserved: true,
    };
  },
});

/**
 * Confirm a withdrawal after on-chain transaction is confirmed.
 * This can be called directly by the frontend after transaction confirmation
 * or by a background job that checks transaction status.
 */
export const confirmWithdrawal = mutation({
  args: {
    pendingTxId: v.id("pending_pool_transactions"),
    chainTxId: v.string(),
    status: v.string(),
    blockHeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the pending transaction
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      throw new Error(`Pending transaction not found: ${args.pendingTxId}`);
    }
    
    // Verify this is a withdrawal transaction
    if (pendingTx.tx_type !== TransactionType.WITHDRAWAL) {
      throw new Error(`Invalid transaction type: ${pendingTx.tx_type}`);
    }
    
    // Update the pending transaction status
    await ctx.db.patch(args.pendingTxId, {
      status: args.status,
      chain_tx_id: args.chainTxId,
      last_checked: Date.now(),
    });
    
    // If the transaction is confirmed or failed, update the provider's balance
    if (args.status === TransactionStatus.CONFIRMED) {
      // Get the provider's current balance
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), pendingTx.provider) && 
          q.eq(q.field("token"), pendingTx.token)
        )
        .unique();
      
      if (balance) {
        // Update existing balance to remove the withdrawn amount
        await ctx.db.patch(balance._id, {
          total_deposited: Math.max(0, balance.total_deposited - pendingTx.amount),
          last_updated: Date.now(),
        });
      }
      
      // Record the transaction in pool_transactions
      await ctx.db.insert("pool_transactions", {
        provider: pendingTx.provider,
        tx_id: pendingTx.tx_id,
        tx_type: pendingTx.tx_type,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: args.status,
        chain_tx_id: args.chainTxId,
        description: `Withdrew ${pendingTx.amount} ${pendingTx.token}`,
      });
      
      console.log("[DEBUG] confirmWithdrawal: pendingTx.token for updatePoolMetrics:", pendingTx.token);
      // Schedule pool metrics update instead of directly calling runAction
      await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, {
        token: pendingTx.token,
      });
      console.log("[DEBUG] Scheduled updatePoolMetrics in confirmWithdrawal");
    } else if (args.status === TransactionStatus.FAILED) {
      // If the withdrawal failed, restore the reserved amount
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), pendingTx.provider) && 
          q.eq(q.field("token"), pendingTx.token)
        )
        .unique();
      
      if (balance) {
        // Restore the available balance
        await ctx.db.patch(balance._id, {
          available_balance: balance.available_balance + pendingTx.amount,
          last_updated: Date.now(),
        });
      }
      
      // Record the failed transaction in pool_transactions
      await ctx.db.insert("pool_transactions", {
        provider: pendingTx.provider,
        tx_id: pendingTx.tx_id,
        tx_type: pendingTx.tx_type,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: args.status,
        chain_tx_id: args.chainTxId,
        description: `Failed withdrawal of ${pendingTx.amount} ${pendingTx.token}`,
      });
    }
    
    return {
      status: args.status,
      txId: pendingTx.tx_id,
      chainTxId: args.chainTxId,
    };
  },
}); 
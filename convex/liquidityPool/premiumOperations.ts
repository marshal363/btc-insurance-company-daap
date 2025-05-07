import { action, internalAction, internalMutation, mutation, query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { TransactionType, TransactionStatus, PremiumDistributionStatus } from "./types"; // Assuming these are in types.ts
import type { PolicyAllocationResult } from "./policyLifecycle"; // Import the type

// --- Interfaces ---

interface RequestPremiumWithdrawalResult {
  pendingTxId: Id<"pending_pool_transactions">;
  txId: string;
  transaction: any; // Blockchain transaction options from preparation actions
  amount: number;
  token: string;
}

interface PremiumDistributionInputItem {
  provider: string;
  token: string;
  allocationId: Id<"policy_allocations">;
  premiumAmount: number;
  allocationPercentage: number;
}

interface PremiumDistributionResultItem extends PremiumDistributionInputItem {
  distributionId: Id<"provider_premium_distributions">;
}

interface CreatePremiumDistributionsResult {
  totalDistributed: number;
  distributions: PremiumDistributionResultItem[];
}

interface DistributePolicyPremiumResult {
  policyId: Id<"policies">;
  token: string;
  totalAmount: number;
  totalDistributed: number;
  providerCount: number;
  distributions: PremiumDistributionResultItem[];
}

// --- Premium Distribution Functions ---

/**
 * Distribute a policy premium to the providers based on their allocation percentages.
 * 
 * @param policyId Policy ID for premium distribution
 * @param amount Total premium amount
 * @param token Token type (currency) of the premium
 * @returns Distribution details with allocated premium amounts
 */
export const distributePolicyPremium = internalAction({
  args: {
    policyId: v.id("policies"),
    amount: v.number(),
    token: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<DistributePolicyPremiumResult> => {
    // 1. Get all allocations for this policy
    const allocations: PolicyAllocationResult[] = await ctx.runQuery(
      internal.liquidityPool.policyLifecycle.getPolicyAllocations, 
      {
        policyId: args.policyId as unknown as string, // Cast because internal.liquidityPool.policyLifecycle.getPolicyAllocations expects string
      }
    );
    
    if (allocations.length === 0) {
      throw new Error(`No allocations found for policy ${args.policyId}`);
    }
    
    // 2. Calculate premium distribution based on allocation percentages
    const distributionsToCreate: PremiumDistributionInputItem[] = [];
    
    for (const allocation of allocations) {
      if (allocation.premium_distributed) {
        // Skip if premium already distributed for this allocation
        continue;
      }
      
      // Calculate the premium amount based on allocation percentage
      const premiumAmount = allocation.premium_share; 
      
      distributionsToCreate.push({
        provider: allocation.provider,
        token: args.token,
        allocationId: allocation._id, // _id is Id<"policy_allocations">
        premiumAmount,
        allocationPercentage: allocation.allocation_percentage,
      });
    }
    
    if (distributionsToCreate.length === 0) {
      throw new Error(`Premiums already distributed for all allocations of policy ${args.policyId}`);
    }
    
    // 3. Create premium distribution records and update provider balances
    const distributionResults = await ctx.runMutation(
      internal.liquidityPool.premiumOperations.createPremiumDistributions, // Self-reference
      {
        policyId: args.policyId,
        token: args.token,
        distributions: distributionsToCreate,
      }
    );
    
    // 4. Log the premium distribution transaction
    // Assuming logGenericPoolTransaction is in transactionManager.ts
    const premiumDistTxId = `prem-dist-${args.policyId}-${Date.now()}`;
    await ctx.runMutation(
      internal.liquidityPool.transactionManager.logGenericPoolTransaction,
      {
        tx_id: premiumDistTxId,
        provider: "SYSTEM", // Or derive appropriately
        tx_type: TransactionType.PREMIUM_DISTRIBUTION,
        amount: args.amount,
        token: args.token,
        timestamp: Date.now(),
        status: TransactionStatus.CONFIRMED,
        description: `Distributed ${args.amount} ${args.token} premium for policy ${args.policyId}`,
        metadata: { policyId: args.policyId, providerCount: distributionsToCreate.length },
        policy_id: args.policyId,
      }
    );
        
    // 5. Update global premium balances (this function might be specific or part of poolState)
    // For now, assuming updatePremiumBalances is a helper here.
    await ctx.runMutation(
      internal.liquidityPool.premiumOperations.updatePremiumBalances, // Self-reference
      {
        token: args.token,
        policyPremiumAmount: args.amount, // The total premium for the policy
        distributedToProviders: distributionResults.totalDistributed, // The amount actually given to providers
      }
    );
    
    // 6. Update pool metrics in the background
    await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, {
      token: args.token,
    });
    
    return {
      policyId: args.policyId,
      token: args.token,
      totalAmount: args.amount,
      totalDistributed: distributionResults.totalDistributed,
      providerCount: distributionsToCreate.length,
      distributions: distributionResults.distributions,
    };
  },
});

/**
 * Create premium distribution records and update provider balances
 */
export const createPremiumDistributions = internalMutation({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    distributions: v.array(
      v.object({
        provider: v.string(),
        token: v.string(),
        allocationId: v.id("policy_allocations"),
        premiumAmount: v.number(),
        allocationPercentage: v.number(),
      })
    ),
  },
  handler: async (ctx: MutationCtx, args): Promise<CreatePremiumDistributionsResult> => {
    let totalDistributed = 0;
    const results: PremiumDistributionResultItem[] = [];
    
    const batchId = `premium-batch-${args.policyId}-${Date.now()}`;
    
    for (const dist of args.distributions) {
      const distributionId = await ctx.db.insert("provider_premium_distributions", {
        policy_id: args.policyId,
        provider: dist.provider,
        token: dist.token,
        premium_amount: dist.premiumAmount,
        allocation_percentage: dist.allocationPercentage,
        distribution_timestamp: Date.now(),
        status: PremiumDistributionStatus.COMPLETED, // Assuming direct completion
        batch_id: batchId,
      });
      
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), dist.provider) && 
          q.eq(q.field("token"), dist.token)
        )
        .unique();
      
      if (balance) {
        await ctx.db.patch(balance._id, {
          earned_premiums: balance.earned_premiums + dist.premiumAmount,
          last_updated: Date.now(),
        });
      } else {
        // This case should ideally not happen if providers are correctly set up
        // Consider creating a balance record or logging an error
        console.warn(`Provider balance not found for ${dist.provider} and token ${dist.token}. Cannot credit earned premium.`);
      }

      // Mark premium as distributed on the allocation
      await ctx.db.patch(dist.allocationId, {
        premium_distributed: true
      });
      
      totalDistributed += dist.premiumAmount;
      results.push({ ...dist, distributionId });
    }
    
    return { totalDistributed, distributions: results };
  },
});

/**
 * Updates the central premium balance tracking for a token.
 * This function is a placeholder for how global premium balances might be tracked.
 * It might need to interact with a specific "pool_premiums" table or similar.
 */
export const updatePremiumBalances = internalMutation({
  args: {
    token: v.string(),
    policyPremiumAmount: v.number(), // Total premium from the policy
    distributedToProviders: v.number(), // Amount distributed to LPs
  },
  handler: async (ctx: MutationCtx, args) => {
    // This is a simplified version. A real system might have a dedicated table
    // for tracking total premiums collected vs. distributed for each token.
    // For now, we'll log it. This function could also update a "pool_metrics" record.
    console.log(`Premium balances updated for token ${args.token}: Policy Premium ${args.policyPremiumAmount}, Distributed to LPs ${args.distributedToProviders}`);
    
    // Example: If there's a global pool_metrics or similar table
    const poolMetric = await ctx.db.query("pool_metrics")
                           .filter(q => q.eq(q.field("token"), args.token))
                           .unique();

    if (poolMetric) {
      await ctx.db.patch(poolMetric._id, {
        total_premiums_collected: (poolMetric.total_premiums_collected || 0) + args.policyPremiumAmount,
        premiums_distributed: (poolMetric.premiums_distributed || 0) + args.distributedToProviders,
        // last_updated_premiums: Date.now(), // Add if schema supports
      });
    } else {
      // Create if not exists - depends on desired behavior
       await ctx.db.insert("pool_metrics", {
        token: args.token,
        total_liquidity: 0, // Initialize other fields as needed
        available_liquidity: 0,
        locked_liquidity: 0,
        active_policies: 0,
        total_premiums_collected: args.policyPremiumAmount,
        premiums_distributed: args.distributedToProviders,
        annualized_yield: 0, // Initialize to 0
        utilization_rate: 0, // Initialize to 0
        avg_policy_duration: 0, // Initialize to 0 or make optional if schema allows
        total_providers: 0, // Initialize to 0
        timestamp: Date.now(), // Use timestamp field as per schema
        // last_updated: Date.now(), // Removed problematic field
      });
    }
    return { success: true };
  }
});


// --- Premium Withdrawal Functions ---

/**
 * Request a withdrawal of earned premiums from the liquidity pool.
 */
export const requestPremiumWithdrawal = action({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx: ActionCtx, args): Promise<RequestPremiumWithdrawalResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to request premium withdrawal");
    }
    const provider = identity.tokenIdentifier;
    
    if (args.amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
    
    const eligibility = await ctx.runQuery(
      internal.liquidityPool.premiumOperations.checkPremiumWithdrawalEligibility, // Changed to internal path
      {
        token: args.token,
        amount: args.amount,
        // provider will be inferred from identity in checkPremiumWithdrawalEligibility
      }
    );
    
    if (!eligibility.eligible) {
      throw new Error(`Premium withdrawal not eligible: ${eligibility.reason}`);
    }
    
    const txId = `prem-withdraw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    let transaction;
    // Assuming blockchainPreparation module exists and functions are correctly named
    if (args.token === "STX") {
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareStxPremiumWithdrawalFromLiquidityPool, 
        { amount: args.amount, recipient: provider }
      );
    } else if (args.token === "sBTC") {
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareSbtcPremiumWithdrawalFromLiquidityPool, 
        { amount: args.amount, recipient: provider }
      );
    } else {
      throw new Error(`Unsupported token type: ${args.token}`);
    }
    
    const pendingTxId = await ctx.runMutation(
      internal.liquidityPool.transactionManager.createPendingPoolTransaction, 
      {
        provider,
        tx_id: txId,
        tx_type: TransactionType.PREMIUM_WITHDRAWAL, // Corrected type
        amount: args.amount,
        token: args.token,
        timestamp: Date.now(),
        payload: { provider, amount: args.amount, token: args.token, transaction },
        status: TransactionStatus.PENDING,
        retry_count: 0,
      }
    );
    
    await ctx.runMutation(
      internal.liquidityPool.premiumOperations.reservePremiumWithdrawalAmount, // Self-reference
      {
        provider,
        token: args.token,
        amount: args.amount,
        pendingTxId,
      }
    );
    
    return {
      pendingTxId,
      txId,
      transaction: transaction.txOptions, // Ensure txOptions is the correct field
      amount: args.amount,
      token: args.token,
    };
  },
});

/**
 * Check if a provider is eligible to withdraw earned premiums.
 */
export const checkPremiumWithdrawalEligibility = internalQuery({
  args: {
    token: v.string(),
    amount: v.number(),
    // provider is implicitly from ctx.auth.getUserIdentity()
  },
  handler: async (ctx: QueryCtx, args): Promise<{ eligible: boolean; reason?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { eligible: false, reason: "Authentication required" };
    }
    const provider = identity.tokenIdentifier;
    
    if (args.amount <= 0) {
      return { eligible: false, reason: "Withdrawal amount must be greater than zero" };
    }
    
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider) && q.eq(q.field("token"), args.token))
      .unique();
    
    if (!balance) {
      return { eligible: false, reason: "No balance record found for this token" };
    }
    
    const availablePremiums = balance.earned_premiums -  // earned_premiums should exist
      (balance.withdrawn_premiums || 0) - // withdrawn_premiums might not exist initially
      (balance.pending_premiums || 0); // pending_premiums might not exist initially
    
    if (args.amount > availablePremiums) {
      return { eligible: false, reason: `Insufficient earned premiums: Available ${availablePremiums}, Requested ${args.amount}` };
    }
    
    // Consider checking for other pending withdrawals of type PREMIUM_WITHDRAWAL
    // This part was simplified from the original snippet which had a more complex check.
    // Adding a basic check for existing pending premium withdrawals:
    const pendingPremiumWithdrawals = await ctx.db
        .query("pending_pool_transactions")
        .filter(q =>
            q.eq(q.field("provider"), provider) &&
            q.eq(q.field("token"), args.token) &&
            q.eq(q.field("tx_type"), TransactionType.PREMIUM_WITHDRAWAL) &&
            q.eq(q.field("status"), TransactionStatus.PENDING)
        )
        .collect();

    if (pendingPremiumWithdrawals.length > 0) {
        const totalPendingAmount = pendingPremiumWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);
        if (args.amount + totalPendingAmount > availablePremiums) {
             return { eligible: false, reason: `Request would exceed available premiums when including other ${totalPendingAmount} ${args.token} pending premium withdrawals.` };
        }
    }

    return { eligible: true };
  },
});

/**
 * Reserves premium withdrawal amount
 */
export const reservePremiumWithdrawalAmount = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amount: v.number(),
    pendingTxId: v.id("pending_pool_transactions"),
  },
  handler: async (ctx: MutationCtx, args) => {
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), args.provider) && q.eq(q.field("token"), args.token))
      .unique();
    
    if (!balance) {
      throw new Error(`Provider balance not found for token ${args.token}`);
    }
    
    const availablePremiums = (balance.earned_premiums || 0) - 
                              (balance.withdrawn_premiums || 0) - 
                              (balance.pending_premiums || 0);
    
    if (availablePremiums < args.amount) {
      // This check should ideally be caught by eligibility, but good to have defense here
      throw new Error(`Insufficient earned premiums at time of reservation: Available ${availablePremiums}, Requested ${args.amount}`);
    }
    
    await ctx.db.patch(balance._id, {
      pending_premiums: (balance.pending_premiums || 0) + args.amount,
      last_updated: Date.now(),
    });
    
    return { reserved: true };
  },
});

/**
 * Confirm a premium withdrawal after on-chain transaction is confirmed.
 */
export const confirmPremiumWithdrawal = mutation({
  args: {
    pendingTxId: v.id("pending_pool_transactions"),
    chainTxId: v.string(), // The actual transaction ID from the blockchain
    status: v.string(), // Should be TransactionStatus.CONFIRMED or TransactionStatus.FAILED
    // blockHeight: v.optional(v.number()), // Optional, if available
  },
  handler: async (ctx: MutationCtx, args) => {
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      throw new Error(`Pending transaction not found: ${args.pendingTxId}`);
    }
    
    if (pendingTx.tx_type !== TransactionType.PREMIUM_WITHDRAWAL) { // Ensure this matches type used in requestPremiumWithdrawal
      throw new Error(`Invalid transaction type: ${pendingTx.tx_type}. Expected PREMIUM_WITHDRAWAL.`);
    }
    
    if (pendingTx.status !== TransactionStatus.PENDING) {
        // Idempotency: if already processed, just return current status.
        console.warn(`Premium withdrawal ${args.pendingTxId} already processed. Current status: ${pendingTx.status}`);
        return { status: pendingTx.status, txId: pendingTx.tx_id, chainTxId: pendingTx.chain_tx_id };
    }

    // Update the pending transaction status
    await ctx.db.patch(args.pendingTxId, {
      status: args.status, // This should be TransactionStatus.CONFIRMED or FAILED
      chain_tx_id: args.chainTxId,
      last_checked: Date.now(), // Or use a more specific field like 'processed_timestamp'
      // block_height: args.blockHeight, // if available and in schema
    });
    
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), pendingTx.provider) && q.eq(q.field("token"), pendingTx.token))
      .unique();
    
    if (!balance) {
      // This is critical, should not happen if reserve was successful
      throw new Error(`Provider balance not found for ${pendingTx.provider}, ${pendingTx.token} during confirmPremiumWithdrawal.`);
    }
    
    if (args.status === TransactionStatus.CONFIRMED) {
      await ctx.db.patch(balance._id, {
        withdrawn_premiums: (balance.withdrawn_premiums || 0) + pendingTx.amount,
        pending_premiums: Math.max(0, (balance.pending_premiums || 0) - pendingTx.amount), // Ensure not negative
        last_updated: Date.now(),
      });
      
      // Log to generic pool_transactions
      await ctx.runMutation(internal.liquidityPool.transactionManager.logGenericPoolTransaction, {
        tx_id: pendingTx.tx_id,
        provider: pendingTx.provider,
        tx_type: TransactionType.PREMIUM_WITHDRAWAL,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: TransactionStatus.CONFIRMED,
        description: `Confirmed premium withdrawal of ${pendingTx.amount} ${pendingTx.token}`,
        chain_tx_id: args.chainTxId,
        metadata: { pendingTxId: args.pendingTxId },
        policy_id: pendingTx.policy_id,
      });

    } else if (args.status === TransactionStatus.FAILED) {
      // Revert the pending_premiums
      await ctx.db.patch(balance._id, {
        pending_premiums: Math.max(0, (balance.pending_premiums || 0) - pendingTx.amount),
        last_updated: Date.now(),
      });

      // Log to generic pool_transactions
       await ctx.runMutation(internal.liquidityPool.transactionManager.logGenericPoolTransaction, {
        tx_id: pendingTx.tx_id,
        provider: pendingTx.provider,
        tx_type: TransactionType.PREMIUM_WITHDRAWAL,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: TransactionStatus.FAILED,
        description: `Failed premium withdrawal of ${pendingTx.amount} ${pendingTx.token}`,
        chain_tx_id: args.chainTxId,
        metadata: { pendingTxId: args.pendingTxId, reason: "Transaction failed on-chain" },
        policy_id: pendingTx.policy_id,
      });
    }
    
    // Schedule pool metrics update if confirmed
    if (args.status === TransactionStatus.CONFIRMED) {
        await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, { token: pendingTx.token });
    }

    return {
      status: args.status,
      txId: pendingTx.tx_id,
      chainTxId: args.chainTxId,
    };
  },
}); 
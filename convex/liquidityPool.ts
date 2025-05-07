import { query, mutation, action, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

// --- Enums ---
export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  PREMIUM = "PREMIUM",
  ALLOCATION = "ALLOCATION",
  COLLATERAL_RELEASE = "COLLATERAL_RELEASE",
  PREMIUM_BATCH = "PREMIUM_BATCH",
  SETTLEMENT = "SETTLEMENT",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum AllocationStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  EXERCISED = "EXERCISED",
  CANCELLED = "CANCELLED",
}

export enum PremiumDistributionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// --- Provider Balance Queries (CV-LP-206) ---

/**
 * Get all balances for a specific provider.
 * Authenticated query - only returns the provider's own balances.
 *
 * @param tokenFilter Optional filter to get balance for specific token
 * @returns Array of provider balance objects
 */
export const getProviderBalances = query({
  args: {
    tokenFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to access provider balances");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Build query for provider balances
    let balancesQuery = ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider));
    
    // Apply token filter if provided
    if (args.tokenFilter) {
      balancesQuery = balancesQuery.filter(q => q.eq(q.field("token"), args.tokenFilter));
    }
    
    // Execute query and collect results
    const balances = await balancesQuery.collect();
    
    // If specific token requested but not found, return empty default
    if (args.tokenFilter && balances.length === 0) {
      return [{
        provider,
        token: args.tokenFilter,
        total_deposited: 0,
        available_balance: 0,
        locked_balance: 0,
        earned_premiums: 0,
        withdrawn_premiums: 0,
        pending_premiums: 0,
        last_updated: Date.now(),
      }];
    }
    
    return balances;
  },
});

/**
 * Get provider balance summary across all tokens.
 * Aggregates data for dashboard display.
 *
 * @returns Summary of balances, activity, and exposure
 */
export const getProviderBalanceSummary = query({
  args: {},
  handler: async (ctx) => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to access provider balance summary");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Get all balances for this provider
    const balances = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider))
      .collect();
    
    // Calculate summary metrics
    const summary = {
      totalDeposited: 0,
      totalAvailable: 0,
      totalLocked: 0,
      totalEarned: 0,
      totalPending: 0,
      
      // Breakdown by token
      tokenBalances: {} as Record<string, {
        total: number,
        available: number,
        locked: number,
        earned: number,
        pending: number,
      }>,
      
      // Count of active allocations
      activeAllocationsCount: 0,
      
      // Last activity timestamp
      lastActivityTimestamp: 0,
    };
    
    // Process each balance
    balances.forEach(balance => {
      // Add to totals
      summary.totalDeposited += balance.total_deposited;
      summary.totalAvailable += balance.available_balance;
      summary.totalLocked += balance.locked_balance;
      summary.totalEarned += balance.earned_premiums;
      summary.totalPending += balance.pending_premiums;
      
      // Update last activity if more recent
      if (balance.last_updated > summary.lastActivityTimestamp) {
        summary.lastActivityTimestamp = balance.last_updated;
      }
      
      // Add to token-specific breakdown
      summary.tokenBalances[balance.token] = {
        total: balance.total_deposited,
        available: balance.available_balance,
        locked: balance.locked_balance,
        earned: balance.earned_premiums,
        pending: balance.pending_premiums,
      };
    });
    
    // Count active allocations
    const activeAllocations = await ctx.db
      .query("policy_allocations")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("status"), AllocationStatus.ACTIVE)
      )
      .collect();
    
    summary.activeAllocationsCount = activeAllocations.length;
    
    return summary;
  },
});

// --- Provider Dashboard Queries (CV-LP-207) ---

/**
 * Get comprehensive provider dashboard data including balances, allocations, 
 * transactions, and yield statistics.
 *
 * @param limit Optional limit for transactions list
 * @param offset Optional offset for transactions pagination
 * @param allocationLimit Optional limit for allocation list
 * @param allocationOffset Optional offset for allocation pagination
 * @returns Dashboard data object with multiple sections
 */
export const getProviderDashboard = query({
  args: {
    transactionLimit: v.optional(v.number()),
    transactionOffset: v.optional(v.number()),
    allocationLimit: v.optional(v.number()),
    allocationOffset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to access provider dashboard");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Set default limits/offsets
    const txLimit = args.transactionLimit || 10;
    const txOffset = args.transactionOffset || 0;
    const allocLimit = args.allocationLimit || 10;
    const allocOffset = args.allocationOffset || 0;
    
    // 1. Get provider balances
    const balances = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider))
      .collect();
    
    // 2. Get recent transactions
    const transactions = await ctx.db
      .query("pool_transactions")
      .filter(q => q.eq(q.field("provider"), provider))
      .order("desc")
      .take(txLimit);
    
    // 3. Get active policy allocations
    const activeAllocations = await ctx.db
      .query("policy_allocations")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("status"), AllocationStatus.ACTIVE)
      )
      .order("desc")
      .take(allocLimit);
    
    // 4. Get expired allocations with premiums
    const expiredAllocations = await ctx.db
      .query("policy_allocations")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("status"), AllocationStatus.EXPIRED)
      )
      .order("desc")
      .take(allocLimit);
    
    // 5. Get premium distributions
    const premiumDistributions = await ctx.db
      .query("provider_premium_distributions")
      .filter(q => q.eq(q.field("provider"), provider))
      .order("desc")
      .take(txLimit);
    
    // 6. Calculate yield statistics
    const yieldStats = await calculateYieldStatistics(ctx, provider, balances);
    
    // 7. Get total allocation counts (for pagination)
    // Use the countRows helper for aggregations
    const [activePolicies, expiredPolicies, totalTransactions] = await Promise.all([
      countRows(ctx.db.query("policy_allocations")
        .filter(q => 
          q.eq(q.field("provider"), provider) && 
          q.eq(q.field("status"), AllocationStatus.ACTIVE)
        )),
      countRows(ctx.db.query("policy_allocations")
        .filter(q => 
          q.eq(q.field("provider"), provider) && 
          q.eq(q.field("status"), AllocationStatus.EXPIRED)
        )),
      countRows(ctx.db.query("pool_transactions")
        .filter(q => q.eq(q.field("provider"), provider)))
    ]);
    
    // Combine all data for dashboard
    return {
      balances,
      transactions,
      activeAllocations,
      expiredAllocations,
      premiumDistributions,
      yieldStats,
      counts: {
        activeAllocationCount: activePolicies,
        expiredAllocationCount: expiredPolicies,
        totalTransactionsCount: totalTransactions,
      }
    };
  }
});

/**
 * Helper function to count rows from a query
 */
async function countRows(query: any): Promise<number> {
  return (await query.collect()).length;
}

/**
 * Calculate yield statistics for a provider based on their balance and premium history.
 * Internal helper for dashboard data.
 * 
 * @param ctx Query context
 * @param provider Provider principal
 * @param balances Provider balances (optional, will query if not provided)
 * @returns Yield statistics object
 */
async function calculateYieldStatistics(
  ctx: QueryCtx,
  provider: string,
  balances?: Doc<"provider_balances">[]
) {
  // Get balances if not provided
  if (!balances) {
    balances = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("provider"), provider))
      .collect();
  }
  
  // Get all transactions for this provider for duration calculations
  const transactions = await ctx.db
    .query("pool_transactions")
    .filter(q => 
      q.eq(q.field("provider"), provider) && 
      q.eq(q.field("tx_type"), TransactionType.DEPOSIT)
    )
    .collect();
  
  // Calculate yield stats per token
  const yieldStats: Record<string, {
    totalDeposited: number,
    currentTotal: number,
    totalEarned: number,
    annualizedYield: number,
    daysActive: number,
    startDate: number | null,
  }> = {};
  
  for (const balance of balances) {
    const token = balance.token;
    
    // Find first deposit date for this token
    const tokenDeposits = transactions.filter(tx => 
      tx.token === token && 
      tx.tx_type === TransactionType.DEPOSIT
    );
    
    const firstDepositDate = tokenDeposits.length > 0
      ? Math.min(...tokenDeposits.map(tx => tx.timestamp))
      : null;
    
    // Calculate days elapsed if we have a first deposit
    const daysElapsed = firstDepositDate
      ? (Date.now() - firstDepositDate) / (1000 * 60 * 60 * 24)
      : 0;
    
    // Calculate total earned (distributed + pending)
    const totalEarned = balance.earned_premiums + balance.pending_premiums;
    
    // Calculate current total (available + locked + pending premiums)
    const currentTotal = balance.available_balance + balance.locked_balance + balance.pending_premiums;
    
    // Calculate annualized yield
    let annualizedYield = 0;
    if (balance.total_deposited > 0 && daysElapsed > 0) {
      // Use a simple average balance approach: total deposited / 2
      // A more accurate approach would weight by time each deposit amount was held
      const averageBalance = balance.total_deposited / 2;
      annualizedYield = (totalEarned / averageBalance) * (365 / daysElapsed) * 100;
    }
    
    yieldStats[token] = {
      totalDeposited: balance.total_deposited,
      currentTotal,
      totalEarned,
      annualizedYield,
      daysActive: daysElapsed,
      startDate: firstDepositDate,
    };
  }
  
  return yieldStats;
}

// --- Pool Metrics Queries (CV-LP-208) ---

/**
 * Get pool metrics for all tokens or a specific token.
 * Public query, no auth required.
 *
 * @param token Optional token filter
 * @returns Pool metrics object
 */
export const getPoolMetrics = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Try to get the most recent metrics for specific token or all tokens
    let metricsQuery = ctx.db
      .query("pool_metrics")
      .order("desc");
    
    if (args.token) {
      metricsQuery = metricsQuery.filter(q => q.eq(q.field("token"), args.token));
    }
    
    // Get the latest metrics entries (one per token)
    const latestMetrics = await metricsQuery.collect();
    
    // If filtered by token, return just that token's metrics or null
    if (args.token) {
      // Find the latest metrics for the specific token
      const tokenMetrics = latestMetrics.find(m => m.token === args.token);
      return tokenMetrics || null;
    }
    
    // Group metrics by token for the response
    const metricsByToken: Record<string, any> = {};
    
    for (const metric of latestMetrics) {
      // Only keep the latest metric per token
      if (!metricsByToken[metric.token] || 
          metric.timestamp > metricsByToken[metric.token].timestamp) {
        metricsByToken[metric.token] = metric;
      }
    }
    
    // Calculate some overall pool stats
    const totalLiquidity = Object.values(metricsByToken).reduce(
      (sum: number, m: any) => sum + m.total_liquidity, 0
    );
    
    const totalAvailable = Object.values(metricsByToken).reduce(
      (sum: number, m: any) => sum + m.available_liquidity, 0
    );
    
    const totalLocked = Object.values(metricsByToken).reduce(
      (sum: number, m: any) => sum + m.locked_liquidity, 0
    );
    
    const avgUtilization = totalLiquidity > 0 
      ? (totalLocked / totalLiquidity) * 100 
      : 0;
    
    // Return both the grouped metrics and the overall stats
    return {
      metrics: metricsByToken,
      overall: {
        totalLiquidity,
        totalAvailable,
        totalLocked,
        utilization: avgUtilization,
        timestamp: Date.now(),
        tokenCount: Object.keys(metricsByToken).length,
      }
    };
  }
});

/**
 * Get historical pool metrics for analytics and charts.
 * 
 * @param token Token to get history for
 * @param timeframe Timeframe (e.g., "day", "week", "month")
 * @param limit Maximum number of data points
 * @returns Historical metrics array
 */
export const getPoolMetricsHistory = query({
  args: {
    token: v.string(),
    timeframe: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 30; // Default to 30 data points
    
    // Convert timeframe to milliseconds for filtering
    let timeframeMs = 24 * 60 * 60 * 1000; // Default to daily (24 hours)
    
    switch (args.timeframe.toLowerCase()) {
      case "hour":
        timeframeMs = 60 * 60 * 1000;
        break;
      case "day":
        timeframeMs = 24 * 60 * 60 * 1000;
        break;
      case "week":
        timeframeMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        timeframeMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case "year":
        timeframeMs = 365 * 24 * 60 * 60 * 1000;
        break;
    }
    
    // Calculate the start time for our historical query
    const startTime = Date.now() - (timeframeMs * limit);
    
    // Get metrics entries for the token with timestamps >= startTime
    const metrics = await ctx.db
      .query("pool_metrics")
      .filter(q => 
        q.eq(q.field("token"), args.token) &&
        q.gte(q.field("timestamp"), startTime)
      )
      .order("asc")
      .collect();
    
    // Group metrics into timeframe buckets
    const buckets: Record<number, any> = {};
    
    for (const metric of metrics) {
      // Calculate which bucket this metric belongs to
      const bucketTime = Math.floor(metric.timestamp / timeframeMs) * timeframeMs;
      
      // Store the latest metric in each bucket
      if (!buckets[bucketTime] || metric.timestamp > buckets[bucketTime].timestamp) {
        buckets[bucketTime] = metric;
      }
    }
    
    // Convert buckets to sorted array
    const result = Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
    
    // Limit the number of results if we got too many
    return result.slice(-limit);
  }
});

// --- Withdrawal Eligibility Queries (CV-LP-209) ---

/**
 * Check if a provider is eligible to withdraw the requested amount.
 * Validates available balance and any pending operations.
 * 
 * @param token Token to withdraw
 * @param amount Amount to withdraw
 * @returns Eligibility object with result and reason
 */
export const checkWithdrawalEligibility = query({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
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

/**
 * Get maximum withdrawal amount for each token the provider has.
 * Useful for withdrawal form UI.
 * 
 * @returns Maximum withdrawal amounts by token
 */
export const getMaxWithdrawalAmounts = query({
  handler: async (ctx) => {
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
    const result: Record<string, {
      availableBalance: number,
      pendingWithdrawals: number,
      maxWithdrawal: number,
      pendingPremiums: number,
    }> = {};
    
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
  transaction: any; // Blockchain transaction options, structure can be firmed up later
  amount: number;
  token: string;
}

export const requestCapitalCommitment = action({
  args: {
    token: v.string(),
    amount: v.number(),
    tier: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<RequestCapitalCommitmentResult> => {
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
    
    // Prepare the deposit transaction based on token type
    let transaction;
    if (args.token === "STX") {
      // For STX, prepare a direct transfer to the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareStxTransferToLiquidityPool, 
        { 
          amount: args.amount,
          sender: provider,
        }
      );
    } else if (args.token === "sBTC") {
      // For sBTC, prepare a SIP-010 token transfer to the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareSbtcTransferToLiquidityPool, 
        { 
          amount: args.amount,
          sender: provider,
        }
      );
    } else {
      throw new Error(`Unsupported token type: ${args.token}`);
    }
    
    // Record the pending transaction in the database
    const pendingTxId: Id<"pending_pool_transactions"> = await ctx.runMutation(
      internal.liquidityPool.createPendingPoolTransaction, 
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
          tier: args.tier || "balanced", // Default to balanced tier
          transaction,
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
 * Internal mutation to create a pending pool transaction record.
 * Used by capital commitment and withdrawal actions.
 */
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
  handler: async (ctx, args) => {
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
      await ctx.scheduler.runAfter(0, internal.liquidityPool.updatePoolMetrics, {
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

/**
 * Internal action to update pool metrics after a significant change.
 */
export const updatePoolMetrics = internalAction({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Calculate pool metrics for the specified token
    
    // 1. Get all provider balances for this token
    const balances: Doc<"provider_balances">[] = await ctx.runQuery(internal.liquidityPool.getProviderBalancesForToken, {
      token: args.token,
    });
    
    // 2. Calculate total and available liquidity
    const totalLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.total_deposited, 0);
    const availableLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.available_balance, 0);
    const lockedLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.locked_balance, 0);
    
    // 3. Count unique providers
    const providerSet = new Set(balances.map((b: Doc<"provider_balances">) => b.provider));
    const totalProviders = providerSet.size;
    
    // 4. Get active policy count for this token
    const activePolicies = await ctx.runQuery(internal.liquidityPool.getActivePolicyCountForToken, {
      token: args.token,
    });
    
    // 5. Calculate utilization rate
    const utilizationRate = totalLiquidity > 0 
      ? (lockedLiquidity / totalLiquidity) * 100 
      : 0;
    
    // 6. Calculate premium statistics
    const premiumStats = await ctx.runQuery(internal.liquidityPool.getPremiumStatsForToken, {
      token: args.token,
    });
    
    // 7. Calculate annualized yield (simplified)
    // For a more accurate calculation, we'd need to consider the time period
    const annualizedYield = calculateAnnualizedYield(
      premiumStats.totalEarned,
      totalLiquidity,
      premiumStats.avgDuration
    );
    
    // 8. Update the metrics in the database
    await ctx.runMutation(internal.liquidityPool.updatePoolMetricsRecord, {
      token: args.token,
      total_liquidity: totalLiquidity,
      available_liquidity: availableLiquidity,
      locked_liquidity: lockedLiquidity,
      total_providers: totalProviders,
      active_policies: activePolicies,
      total_premiums_collected: premiumStats.totalCollected,
      premiums_distributed: premiumStats.totalDistributed,
      annualized_yield: annualizedYield,
      avg_policy_duration: premiumStats.avgDuration,
      utilization_rate: utilizationRate,
    });
    
    return {
      token: args.token,
      updated: true,
    };
  },
});

/**
 * Helper function to calculate annualized yield
 */
function calculateAnnualizedYield(
  totalEarned: number,
  totalLiquidity: number,
  avgDurationDays: number
): number {
  if (totalLiquidity <= 0 || avgDurationDays <= 0) {
    return 0;
  }
  
  // Calculate the yield rate for the average duration
  const yieldRate = totalEarned / totalLiquidity;
  
  // Annualize the yield (scale to 365 days)
  const annualizedYield = yieldRate * (365 / avgDurationDays) * 100;
  
  return annualizedYield;
}

// -- Internal Queries for Pool Metrics --

export const getProviderBalancesForToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("token"), args.token))
      .collect();
  },
});

export const getActivePolicyCountForToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<number> => {
    const activeAllocations = await ctx.db
      .query("policy_allocations")
      .filter(q => 
        q.eq(q.field("token"), args.token) && 
        q.eq(q.field("status"), AllocationStatus.ACTIVE)
      )
      .collect();
    
    // Count unique policies
    const policyIds = new Set(activeAllocations.map((a: Doc<"policy_allocations">) => a.policy_id));
    return policyIds.size;
  },
});

export const getPremiumStatsForToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Get premium balance record for this token
    const premiumBalance = await ctx.db
      .query("premium_balances")
      .filter(q => q.eq(q.field("token"), args.token))
      .unique();
    
    if (!premiumBalance) {
      return {
        totalCollected: 0,
        totalDistributed: 0,
        totalEarned: 0,
        avgDuration: 30, // Default to 30 days if no data
      };
    }
    
    // Get completed premium distributions for calculation
    const distributions = await ctx.db
      .query("provider_premium_distributions")
      .filter(q => 
        q.eq(q.field("token"), args.token) && 
        q.eq(q.field("status"), PremiumDistributionStatus.COMPLETED)
      )
      .collect();
    
    // Calculate total earned from distributions
    const totalEarned = distributions.reduce(
      (sum, d) => sum + d.premium_amount, 0
    );
    
    // For avg duration, we'd ideally look at policy durations
    // For now, use a fixed value (in a real system, this would be calculated)
    const avgDuration = 30; // 30 days
    
    return {
      totalCollected: premiumBalance.total_premiums,
      totalDistributed: premiumBalance.distributed_premiums,
      totalEarned,
      avgDuration,
    };
  },
});

export const updatePoolMetricsRecord = internalMutation({
  args: {
    token: v.string(),
    total_liquidity: v.number(),
    available_liquidity: v.number(),
    locked_liquidity: v.number(),
    total_providers: v.number(),
    active_policies: v.number(),
    total_premiums_collected: v.number(),
    premiums_distributed: v.number(),
    annualized_yield: v.number(),
    avg_policy_duration: v.optional(v.number()),
    utilization_rate: v.number(),
  },
  handler: async (ctx, args) => {
    // Create a new metrics record
    return await ctx.db.insert("pool_metrics", {
      timestamp: Date.now(),
      token: args.token,
      total_liquidity: args.total_liquidity,
      available_liquidity: args.available_liquidity,
      locked_liquidity: args.locked_liquidity,
      total_providers: args.total_providers,
      active_policies: args.active_policies,
      total_premiums_collected: args.total_premiums_collected,
      premiums_distributed: args.premiums_distributed,
      annualized_yield: args.annualized_yield,
      avg_policy_duration: args.avg_policy_duration,
      utilization_rate: args.utilization_rate,
    });
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
  handler: async (ctx, args): Promise<RequestWithdrawalResult> => {
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
      api.liquidityPool.checkWithdrawalEligibility,
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
      internal.liquidityPool.createPendingPoolTransaction, 
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
      internal.liquidityPool.reserveWithdrawalAmount,
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
      await ctx.scheduler.runAfter(0, internal.liquidityPool.updatePoolMetrics, {
        token: pendingTx.token,
      });
      console.log("[DEBUG] Scheduled updatePoolMetrics in confirmWithdrawal");
    } else if (args.status === TransactionStatus.FAILED) {
      // Return the reserved amount to available balance
      // Get the provider's current balance
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), pendingTx.provider) && 
          q.eq(q.field("token"), pendingTx.token)
        )
        .unique();
      
      if (balance) {
        // Return the amount to available balance
        await ctx.db.patch(balance._id, {
          available_balance: balance.available_balance + pendingTx.amount,
          last_updated: Date.now(),
        });
      }
      
      // Record the failed transaction
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

// --- Policy Allocation Actions (CV-LP-212) ---

/**
 * Allocate capital from the liquidity pool to a new policy.
 * This function distributes the required collateral among eligible providers.
 * 
 * @param policyId ID of the policy requiring collateral
 * @param token Token used for collateral
 * @param totalAmount Total amount of collateral required
 * @param premium Premium amount to be distributed
 * @param startDate Policy start date
 * @param endDate Policy end date
 * @returns Allocation details with provider distributions
 */
export const allocateCapitalForPolicy = internalAction({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    totalAmount: v.number(),
    premium: v.number(),
    startDate: v.number(),
    endDate: v.number(),
    riskParameters: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Get all providers with available balance for this token
    const eligibleProviders = await ctx.runQuery(
      internal.liquidityPool.getEligibleProvidersForAllocation,
      {
        token: args.token,
        minRequiredAmount: args.totalAmount * 0.01, // Provider must have at least 1% of required amount
      }
    );
    
    if (eligibleProviders.length === 0) {
      throw new Error(`No eligible providers found for token ${args.token}`);
    }
    
    // 2. Calculate total available capital
    const totalAvailableCapital = eligibleProviders.reduce(
      (sum: number, provider: any) => sum + provider.availableBalance,
      0
    );
    
    if (totalAvailableCapital < args.totalAmount) {
      throw new Error(`Insufficient available capital: ${totalAvailableCapital} < ${args.totalAmount}`);
    }
    
    // 3. Determine allocation strategy based on risk parameters and provider tiers
    const allocations = await determineAllocationStrategy(
      eligibleProviders,
      args.totalAmount,
      args.token,
      args.riskParameters
    );
    
    // 4. Create policy allocations records and lock provider balances
    const allocationResults = await ctx.runMutation(
      internal.liquidityPool.createPolicyAllocations,
      {
        policyId: args.policyId,
        token: args.token,
        allocations: allocations,
        premium: args.premium,
        startDate: args.startDate,
        endDate: args.endDate,
      }
    );
    
    // 5. Log the allocation transaction
    await ctx.runMutation(
      internal.liquidityPool.logAllocationTransaction,
      {
        policyId: args.policyId,
        token: args.token,
        totalAmount: args.totalAmount,
        premium: args.premium,
        providerCount: allocations.length,
      }
    );
    
    // 6. Update pool metrics in the background
    ctx.runAction(internal.liquidityPool.updatePoolMetrics, {
      token: args.token,
    });
    
    return {
      policyId: args.policyId,
      token: args.token,
      totalAmount: args.totalAmount,
      premium: args.premium,
      providerCount: allocations.length,
      allocations: allocationResults,
    };
  },
});

/**
 * Helper function to determine allocation strategy based on risk parameters
 * and provider characteristics.
 */
async function determineAllocationStrategy(
  providers: { provider: string; availableBalance: number; totalDeposited: number; lockedBalance: number }[],
  totalAmount: number,
  token: string,
  riskParameters: any // Keeping as any for now, can be refined if specific structure is known
): Promise<any[]> {
  // Sort providers by available balance (largest first)
  const sortedProviders = [...providers].sort(
    (a, b) => b.availableBalance - a.availableBalance
  );
  
  // For now, implement a simple proportional allocation
  // In a production system, this would include more sophisticated logic
  // based on risk tiers, provider history, and diversification requirements
  
  const totalAvailable = sortedProviders.reduce(
    (sum: number, p: { availableBalance: number }) => sum + p.availableBalance,
    0
  );
  
  const allocations = sortedProviders.map((provider: { provider: string; availableBalance: number }) => {
    // Calculate proportional allocation
    const proportion = provider.availableBalance / totalAvailable;
    const allocatedAmount = Math.min(
      provider.availableBalance,
      totalAmount * proportion
    );
    
    // Ensure we don't allocate more than available or needed
    const finalAmount = Math.min(
      allocatedAmount,
      provider.availableBalance,
      totalAmount
    );
    
    return {
      provider: provider.provider,
      allocatedAmount: finalAmount,
      allocationPercentage: (finalAmount / totalAmount) * 100,
    };
  });
  
  // Adjust allocations to ensure the total is exactly what's needed
  const allocatedTotal = allocations.reduce(
    (sum: number, alloc: { allocatedAmount: number }) => sum + alloc.allocatedAmount,
    0
  );
  
  if (allocatedTotal < totalAmount) {
    // Distribute the shortfall proportionally
    let shortfall = totalAmount - allocatedTotal; // Changed const to let
    
    for (let i = 0; i < allocations.length && shortfall > 0; i++) {
      const provider = sortedProviders[i];
      const alloc = allocations[i];
      
      const additionalAmount = Math.min(
        shortfall,
        provider.availableBalance - alloc.allocatedAmount
      );
      
      if (additionalAmount > 0) {
        alloc.allocatedAmount += additionalAmount;
        alloc.allocationPercentage = (alloc.allocatedAmount / totalAmount) * 100;
        shortfall -= additionalAmount;
      }
    }
  }
  
  return allocations;
}

/**
 * Create policy allocation records and lock provider balances
 */
export const createPolicyAllocations = internalMutation({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    allocations: v.array(
      v.object({
        provider: v.string(),
        allocatedAmount: v.number(),
        allocationPercentage: v.number(),
      })
    ),
    premium: v.number(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const results = [];
    
    for (const allocation of args.allocations) {
      // Calculate premium share based on allocation percentage
      const premiumShare = (args.premium * allocation.allocationPercentage) / 100;
      
      // Create allocation record
      const allocationId = await ctx.db.insert("policy_allocations", {
        policy_id: args.policyId,
        provider: allocation.provider,
        token: args.token,
        allocated_amount: allocation.allocatedAmount,
        allocation_percentage: allocation.allocationPercentage,
        premium_share: premiumShare,
        premium_distributed: false,
        allocation_timestamp: Date.now(),
        status: AllocationStatus.ACTIVE,
      });
      
      // Update provider balance: lock the allocated amount
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), allocation.provider) && 
          q.eq(q.field("token"), args.token)
        )
        .unique();
      
      if (balance) {
        await ctx.db.patch(balance._id, {
          available_balance: balance.available_balance - allocation.allocatedAmount,
          locked_balance: balance.locked_balance + allocation.allocatedAmount,
          last_updated: Date.now(),
        });
      } else {
        throw new Error(`Provider balance not found: ${allocation.provider}, ${args.token}`);
      }
      
      results.push({
        allocationId,
        provider: allocation.provider,
        allocatedAmount: allocation.allocatedAmount,
        premiumShare,
      });
    }
    
    return results;
  },
});

/**
 * Log allocation transaction
 */
export const logAllocationTransaction = internalMutation({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    totalAmount: v.number(),
    premium: v.number(),
    providerCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Generate a unique transaction ID
    const txId = `alloc-${args.policyId}-${Date.now()}`;
    
    const transactionData = { 
      tx_id: txId,
      provider: "SYSTEM_ALLOCATION", // Added system provider
      tx_type: TransactionType.ALLOCATION,
      amount: args.totalAmount,
      token: args.token,
      timestamp: Date.now(),
      status: TransactionStatus.CONFIRMED,
      policy_id: args.policyId,
      description: `Allocated ${args.totalAmount} ${args.token} for policy among ${args.providerCount} providers`,
      metadata: { // Moved related_info content here
        premium: args.premium,
        provider_count: args.providerCount,
      },
    };
    console.log("[DEBUG] logAllocationTransaction: Data for insert:", JSON.stringify(transactionData));
    return await ctx.db.insert("pool_transactions", transactionData);
  },
});

/**
 * Get eligible providers for allocation
 */
export const getEligibleProvidersForAllocation = internalQuery({
  args: {
    token: v.string(),
    minRequiredAmount: v.number(),
  },
  handler: async (ctx, args): Promise<any[]> => {
    const balances = await ctx.db
      .query("provider_balances")
      .filter(q => 
        q.eq(q.field("token"), args.token) && 
        q.gte(q.field("available_balance"), args.minRequiredAmount)
      )
      .collect();
    
    return balances.map(b => ({
      provider: b.provider,
      availableBalance: b.available_balance,
      totalDeposited: b.total_deposited,
      lockedBalance: b.locked_balance,
    }));
  },
});

// --- Premium Distribution Actions (CV-LP-222) ---

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
  handler: async (ctx, args): Promise<any> => {
    // 1. Get all allocations for this policy
    const allocations = await ctx.runQuery(
      internal.liquidityPool.getPolicyAllocations,
      {
        policyId: args.policyId,
      }
    );
    
    if (allocations.length === 0) {
      throw new Error(`No allocations found for policy ${args.policyId}`);
    }
    
    // 2. Calculate premium distribution based on allocation percentages
    let totalDistributedPercentage = 0;
    const distributions = [];
    
    for (const allocation of allocations) {
      if (allocation.premium_distributed) {
        // Skip if premium already distributed for this allocation
        continue;
      }
      
      // Calculate the premium amount based on allocation percentage
      const premiumAmount = allocation.premium_share;
      
      distributions.push({
        provider: allocation.provider,
        token: args.token,
        allocationId: allocation._id,
        premiumAmount,
        allocationPercentage: allocation.allocation_percentage,
      });
      
      totalDistributedPercentage += allocation.allocation_percentage;
    }
    
    if (distributions.length === 0) {
      throw new Error(`Premiums already distributed for all allocations of policy ${args.policyId}`);
    }
    
    // 3. Create premium distribution records and update provider balances
    const distributionResults = await ctx.runMutation(
      internal.liquidityPool.createPremiumDistributions,
      {
        policyId: args.policyId,
        token: args.token,
        distributions,
      }
    );
    
    // 4. Log the premium distribution transaction
    await ctx.runMutation(
      internal.liquidityPool.logPremiumDistributionTransaction,
      {
        policyId: args.policyId,
        token: args.token,
        totalAmount: args.amount,
        providerCount: distributions.length,
      }
    );
    
    // 5. Update premium balances
    await ctx.runMutation(
      internal.liquidityPool.updatePremiumBalances,
      {
        token: args.token,
        amount: args.amount,
        distributedAmount: distributionResults.totalDistributed,
      }
    );
    
    // 6. Update pool metrics in the background
    ctx.runAction(internal.liquidityPool.updatePoolMetrics, {
      token: args.token,
    });
    
    return {
      policyId: args.policyId,
      token: args.token,
      totalAmount: args.amount,
      totalDistributed: distributionResults.totalDistributed,
      providerCount: distributions.length,
      distributions: distributionResults.distributions,
    };
  },
});

/**
 * Get all allocations for a policy
 */
export const getPolicyAllocations = internalQuery({
  args: {
    policyId: v.id("policies"),
  },
  handler: async (ctx, args): Promise<any[]> => {
    return await ctx.db
      .query("policy_allocations")
      .filter(q => q.eq(q.field("policy_id"), args.policyId))
      .collect();
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
  handler: async (ctx, args): Promise<{ totalDistributed: number; distributions: any[] }> => {
    let totalDistributed = 0;
    const results = [];
    
    // Generate a batch ID for grouping these distributions
    const batchId = `premium-batch-${args.policyId}-${Date.now()}`;
    
    for (const dist of args.distributions) {
      // Create distribution record
      const distributionId = await ctx.db.insert("provider_premium_distributions", {
        policy_id: args.policyId,
        provider: dist.provider,
        token: dist.token,
        premium_amount: dist.premiumAmount,
        allocation_percentage: dist.allocationPercentage,
        distribution_timestamp: Date.now(),
        status: PremiumDistributionStatus.COMPLETED,
        batch_id: batchId,
      });
      
      // Update provider balance: add premium to earned premiums
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
        // Create a new provider balance record if none exists
        await ctx.db.insert("provider_balances", {
          provider: dist.provider,
          token: dist.token,
          total_deposited: 0,
          available_balance: 0,
          locked_balance: 0,
          earned_premiums: dist.premiumAmount,
          withdrawn_premiums: 0,
          pending_premiums: 0,
          last_updated: Date.now(),
        });
      }
      
      // Mark the allocation as having its premium distributed
      await ctx.db.patch(dist.allocationId, {
        premium_distributed: true,
      });
      
      // Update totals and results
      totalDistributed += dist.premiumAmount;
      
      results.push({
        distributionId,
        provider: dist.provider,
        premiumAmount: dist.premiumAmount,
        allocationPercentage: dist.allocationPercentage,
      });
    }
    
    return {
      totalDistributed,
      distributions: results,
    };
  },
});

/**
 * Log premium distribution transaction
 */
export const logPremiumDistributionTransaction = internalMutation({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    totalAmount: v.number(),
    providerCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Generate a unique transaction ID
    const txId = `premium-${args.policyId}-${Date.now()}`;
    
    const transactionData = { 
      tx_id: txId,
      provider: "SYSTEM_PREMIUM_DISTRIBUTION", // Added system provider
      tx_type: TransactionType.PREMIUM,
      amount: args.totalAmount,
      token: args.token,
      timestamp: Date.now(),
      status: TransactionStatus.CONFIRMED,
      policy_id: args.policyId,
      description: `Distributed ${args.totalAmount} ${args.token} premium to ${args.providerCount} providers`,
    };
    console.log("[DEBUG] logPremiumDistributionTransaction: Data for insert:", JSON.stringify(transactionData));
    return await ctx.db.insert("pool_transactions", transactionData);
  },
});

/**
 * Update premium balances
 */
export const updatePremiumBalances = internalMutation({
  args: {
    token: v.string(),
    amount: v.number(),
    distributedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Get existing premium balance record for this token
    const premiumBalance = await ctx.db
      .query("premium_balances")
      .filter(q => q.eq(q.field("token"), args.token))
      .unique();
    
    if (premiumBalance) {
      // Update existing record
      await ctx.db.patch(premiumBalance._id, {
        total_premiums: premiumBalance.total_premiums + args.amount,
        distributed_premiums: premiumBalance.distributed_premiums + args.distributedAmount,
        last_updated: Date.now(),
      });
      
      return premiumBalance._id;
    } else {
      // Create new record
      return await ctx.db.insert("premium_balances", {
        token: args.token,
        total_premiums: args.amount,
        distributed_premiums: args.distributedAmount,
        last_updated: Date.now(),
      });
    }
  },
});

// --- Collateral Release Actions (CV-LP-213) ---

/**
 * Release locked collateral when a policy expires or is cancelled.
 * Updates policy allocation status and returns locked funds to provider available balance.
 * 
 * @param policyId ID of the policy with collateral to release
 * @param reason Reason for release (EXPIRED, CANCELLED, SETTLED)
 * @returns Summary of released collateral by provider
 */
export const releaseCollateral = internalAction({
  args: {
    policyId: v.id("policies"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Get all allocations for this policy
    const allocations: Doc<"policy_allocations">[] = await ctx.runQuery(
      internal.liquidityPool.getPolicyAllocations,
      {
        policyId: args.policyId,
      }
    );
    
    if (allocations.length === 0) {
      throw new Error(`No allocations found for policy ${args.policyId}`);
    }
    
    // Check if allocations are already released
    const activeAllocations = allocations.filter(
      (a: Doc<"policy_allocations">) => a.status === AllocationStatus.ACTIVE
    );
    
    if (activeAllocations.length === 0) {
      throw new Error(`All allocations for policy ${args.policyId} are already released`);
    }
    
    // 2. Release collateral for each allocation
    let totalReleased = 0;
    let token = "";
    
    const releaseResults = await ctx.runMutation(
      internal.liquidityPool.releaseAllocationCollateral,
      {
        policyId: args.policyId,
        allocationIds: activeAllocations.map((a: Doc<"policy_allocations">) => a._id),
        reason: args.reason,
      }
    );
    
    totalReleased = releaseResults.totalReleased;
    token = releaseResults.token;
    
    // 3. Log the collateral release transaction
    await ctx.runMutation(
      internal.liquidityPool.logCollateralReleaseTransaction,
      {
        policyId: args.policyId,
        token,
        totalAmount: totalReleased,
        providerCount: activeAllocations.length,
        reason: args.reason,
      }
    );
    
    // 4. Update pool metrics in the background
    ctx.runAction(internal.liquidityPool.updatePoolMetrics, {
      token,
    });
    
    return {
      policyId: args.policyId,
      token,
      totalReleased,
      providerCount: activeAllocations.length,
      reason: args.reason,
      providers: releaseResults.providers,
    };
  },
});

/**
 * Release allocation collateral
 */
export const releaseAllocationCollateral = internalMutation({
  args: {
    policyId: v.id("policies"),
    allocationIds: v.array(v.id("policy_allocations")),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<{
    totalReleased: number;
    token: string;
    providers: any[];
  }> => {
    let totalReleased = 0;
    let token = "";
    const providers = [];
    
    // Map reason to allocation status
    let newStatus;
    switch (args.reason) {
      case "EXPIRED":
        newStatus = AllocationStatus.EXPIRED;
        break;
      case "EXERCISED":
        newStatus = AllocationStatus.EXERCISED;
        break;
      case "CANCELED": // Typo was here
        newStatus = AllocationStatus.CANCELLED; // Corrected to CANCELLED
        break;
      default:
        throw new Error(`Invalid release reason: ${args.reason}`);
    }
    
    // Process each allocation
    for (const allocationId of args.allocationIds) {
      // Get the allocation details
      const allocation = await ctx.db.get(allocationId);
      if (!allocation) {
        continue; // Skip if allocation not found
      }
      
      if (allocation.status !== AllocationStatus.ACTIVE) {
        continue; // Skip if already released
      }
      
      // Set token if not set yet
      if (!token) {
        token = allocation.token;
      }
      
      // Update allocation status
      await ctx.db.patch(allocationId, {
        status: newStatus,
      });
      
      // Get provider balance
      const balance = await ctx.db
        .query("provider_balances")
        .filter(q => 
          q.eq(q.field("provider"), allocation.provider) && 
          q.eq(q.field("token"), allocation.token)
        )
        .unique();
      
      if (balance) {
        // Release collateral back to available balance
        // If EXERCISED, don't return to available (it's being used for the claim)
        if (newStatus !== AllocationStatus.EXERCISED) {
          await ctx.db.patch(balance._id, {
            available_balance: balance.available_balance + allocation.allocated_amount,
            locked_balance: balance.locked_balance - allocation.allocated_amount,
            last_updated: Date.now(),
          });
        } else {
          // For exercised policies, just reduce the locked balance
          // The actual funds are being transferred to the policyholder
          await ctx.db.patch(balance._id, {
            locked_balance: balance.locked_balance - allocation.allocated_amount,
            last_updated: Date.now(),
          });
        }
      }
      
      // Update totals
      totalReleased += allocation.allocated_amount;
      
      // Add to providers list
      providers.push({
        provider: allocation.provider,
        amount: allocation.allocated_amount,
        allocationId,
      });
    }
    
    return {
      totalReleased,
      token,
      providers,
    };
  },
});

/**
 * Log collateral release transaction
 */
export const logCollateralReleaseTransaction = internalMutation({
  args: {
    policyId: v.id("policies"),
    token: v.string(),
    totalAmount: v.number(),
    providerCount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate a unique transaction ID
    const txId = `release-${args.policyId}-${Date.now()}`;
    
    const transactionData = { 
      tx_id: txId,
      provider: "SYSTEM_COLLATERAL_RELEASE", // Added system provider
      tx_type: TransactionType.COLLATERAL_RELEASE,
      amount: args.totalAmount,
      token: args.token,
      timestamp: Date.now(),
      status: TransactionStatus.CONFIRMED,
      policy_id: args.policyId,
      description: `Released ${args.totalAmount} ${args.token} collateral from ${args.providerCount} providers (${args.reason})`,
    };
    console.log("[DEBUG] logCollateralReleaseTransaction: Data for insert:", JSON.stringify(transactionData));
    return await ctx.db.insert("pool_transactions", transactionData);
  },
});

// --- Premium Withdrawal Actions (CV-LP-224) ---

/**
 * Request a withdrawal of earned premiums from the liquidity pool.
 * Validates eligibility, prepares transaction for processing, and returns
 * transaction data for the user to sign.
 * 
 * @param token Token to withdraw (e.g., "STX", "sBTC")
 * @param amount Amount of earned premiums to withdraw
 * @returns Pending transaction record and blockchain transaction data
 */
export const requestPremiumWithdrawal = action({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to request premium withdrawal");
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Validate input
    if (args.amount <= 0) {
      throw new Error("Withdrawal amount must be greater than zero");
    }
    
    // Check premium withdrawal eligibility
    const eligibility = await ctx.runQuery(
      api.liquidityPool.checkPremiumWithdrawalEligibility,
      {
        token: args.token,
        amount: args.amount,
      }
    );
    
    if (!eligibility.eligible) {
      throw new Error(`Premium withdrawal not eligible: ${eligibility.reason}`);
    }
    
    // Generate a unique transaction ID for tracking
    const txId = `prem-withdraw-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Prepare the withdrawal transaction based on token type
    let transaction;
    if (args.token === "STX") {
      // For STX, prepare a withdrawal from the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareStxPremiumWithdrawalFromLiquidityPool, 
        { 
          amount: args.amount,
          recipient: provider,
        }
      );
    } else if (args.token === "sBTC") {
      // For sBTC, prepare a SIP-010 token withdrawal from the pool contract
      transaction = await ctx.runAction(
        internal.blockchainPreparation.prepareSbtcPremiumWithdrawalFromLiquidityPool, 
        { 
          amount: args.amount,
          recipient: provider,
        }
      );
    } else {
      throw new Error(`Unsupported token type: ${args.token}`);
    }
    
    // Record the pending transaction in the database
    const pendingTxId = await ctx.runMutation(
      internal.liquidityPool.createPendingPoolTransaction, 
      {
        provider,
        tx_id: txId,
        tx_type: TransactionType.PREMIUM,
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
    
    // Reserve the withdrawal amount from earned premiums
    await ctx.runMutation(
      internal.liquidityPool.reservePremiumWithdrawalAmount,
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
 * Check if a provider is eligible to withdraw earned premiums.
 * Validates available earned premiums and any pending operations.
 * 
 * @param token Token to withdraw
 * @param amount Amount to withdraw
 * @returns Eligibility object with result and reason
 */
export const checkPremiumWithdrawalEligibility = query({
  args: {
    token: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args): Promise<{ eligible: boolean; reason?: string }> => {
    // Get the authenticated user's identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        eligible: false,
        reason: "Authentication required to check premium withdrawal eligibility",
      };
    }
    
    // Extract provider principal from identity
    const provider = identity.tokenIdentifier;
    
    // Validate input
    if (args.amount <= 0) {
      return {
        eligible: false,
        reason: "Withdrawal amount must be greater than zero",
      };
    }
    
    // Get the provider's current balance
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("token"), args.token)
      )
      .unique();
    
    // Check if provider has a balance record for this token
    if (!balance) {
      return {
        eligible: false,
        reason: "No balance record found for this token",
      };
    }
    
    // Calculate available earned premiums (earned - withdrawn - pending)
    const availablePremiums = balance.earned_premiums - 
      balance.withdrawn_premiums - 
      balance.pending_premiums;
    
    // Check if the withdrawal amount exceeds available premiums
    if (args.amount > availablePremiums) {
      return {
        eligible: false,
        reason: `Insufficient earned premiums: ${availablePremiums} < ${args.amount}`,
      };
    }
    
    // Check if there are any pending premium withdrawals
    const pendingWithdrawals = await ctx.db
      .query("pending_pool_transactions")
      .filter(q => 
        q.eq(q.field("provider"), provider) && 
        q.eq(q.field("token"), args.token) && 
        q.eq(q.field("tx_type"), TransactionType.PREMIUM) && 
        q.eq(q.field("status"), TransactionStatus.PENDING)
      )
      .collect();
    
    // If there are pending withdrawals, check if they would exceed available premiums
    if (pendingWithdrawals.length > 0) {
      const pendingAmount = pendingWithdrawals.reduce(
        (sum: number, tx: any) => sum + tx.amount, 
        0
      );
      
      if (args.amount + pendingAmount > availablePremiums) {
        return {
          eligible: false,
          reason: `Withdrawal would exceed available premiums when including pending withdrawals`,
        };
      }
    }
    
    // All checks passed
    return {
      eligible: true,
    };
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
    
    // Verify available earned premiums are sufficient
    const availablePremiums = balance.earned_premiums - 
      balance.withdrawn_premiums - 
      balance.pending_premiums;
    
    if (availablePremiums < args.amount) {
      throw new Error(`Insufficient earned premiums: ${availablePremiums} < ${args.amount}`);
    }
    
    // Update the balance to reserve the withdrawal amount
    await ctx.db.patch(balance._id, {
      pending_premiums: balance.pending_premiums + args.amount,
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
 * Confirm a premium withdrawal after on-chain transaction is confirmed.
 * This can be called directly by the frontend after transaction confirmation
 * or by a background job that checks transaction status.
 */
export const confirmPremiumWithdrawal = mutation({
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
    
    // Verify this is a premium withdrawal transaction
    if (pendingTx.tx_type !== TransactionType.PREMIUM) {
      throw new Error(`Invalid transaction type: ${pendingTx.tx_type}`);
    }
    
    // Update the pending transaction status
    await ctx.db.patch(args.pendingTxId, {
      status: args.status,
      chain_tx_id: args.chainTxId,
      last_checked: Date.now(),
    });
    
    // Get the provider's current balance
    const balance = await ctx.db
      .query("provider_balances")
      .filter(q => 
        q.eq(q.field("provider"), pendingTx.provider) && 
        q.eq(q.field("token"), pendingTx.token)
      )
      .unique();
    
    if (!balance) {
      throw new Error(`Provider balance not found: ${pendingTx.provider}, ${pendingTx.token}`);
    }
    
    // If the transaction is confirmed, update the withdrawn amount
    if (args.status === TransactionStatus.CONFIRMED) {
      // Update provider balance
      await ctx.db.patch(balance._id, {
        withdrawn_premiums: balance.withdrawn_premiums + pendingTx.amount,
        pending_premiums: balance.pending_premiums - pendingTx.amount,
        last_updated: Date.now(),
      });
      
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
        description: `Withdrew ${pendingTx.amount} ${pendingTx.token} in earned premiums`,
      });
    } else if (args.status === TransactionStatus.FAILED) {
      // Return the reserved amount
      await ctx.db.patch(balance._id, {
        pending_premiums: balance.pending_premiums - pendingTx.amount,
        last_updated: Date.now(),
      });
      
      // Record the failed transaction
      await ctx.db.insert("pool_transactions", {
        provider: pendingTx.provider,
        tx_id: pendingTx.tx_id,
        tx_type: pendingTx.tx_type,
        amount: pendingTx.amount,
        token: pendingTx.token,
        timestamp: Date.now(),
        status: args.status,
        chain_tx_id: args.chainTxId,
        description: `Failed withdrawal of ${pendingTx.amount} ${pendingTx.token} in earned premiums`,
      });
    }
    
    return {
      status: args.status,
      txId: pendingTx.tx_id,
      chainTxId: args.chainTxId,
    };
  },
});

// Service implementations will go here
console.log("convex/liquidityPool.ts loaded: Defines Liquidity Pool service functions."); 
import { query, internalQuery, internalMutation, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal, api } from "../_generated/api";
import { TransactionType, AllocationStatus } from "./types";

/**
 * Helper function to count rows in a query result
 * Used for pagination calculations
 */
async function countRows(query: any) {
  const results = await query.collect();
  return results.length;
}

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
 * Calculate yield statistics for a provider based on their balance and premium history.
 * Internal helper for dashboard data.
 * 
 * @param ctx Query context
 * @param provider Provider principal
 * @param balances Provider balances (optional, will query if not provided)
 * @returns Yield statistics object
 */
export const calculateYieldStatistics = async (
  ctx: QueryCtx,
  provider: string,
  balances?: Doc<"provider_balances">[]
) => {
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
}; 
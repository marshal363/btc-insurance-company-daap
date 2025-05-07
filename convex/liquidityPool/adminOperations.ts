import { query, internalQuery, internalMutation, action } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { AllocationStatus } from "./types"; // Assuming AllocationStatus might be used or is good to have with other admin types

// CV-LP-231: Implement getSystemPoolStats query (admin-only)

interface SystemPoolStatsResult {
  success: boolean;
  message?: string;
  stats?: {
    totalTokensTrackedInMetrics: number;
    overallTVLApproximation: number; // Sum of total_liquidity from latest pool_metrics, needs price conversion for true USD TVL
    overallAvailableLiquidityApproximation: number;
    overallLockedLiquidityApproximation: number;
    latestMetricsByToken: Record<string, Doc<"pool_metrics">>;
    totalUniqueProviders: number;
    totalPoolTransactions: number; // Consider adding time filter for relevance
    totalActivePolicyAllocations: number;
    // Add more aggregated stats as needed
  };
}

export const getSystemPoolStats = query({
  args: {},
  handler: async (ctx, args): Promise<SystemPoolStatsResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return { success: false, message: "Authentication required." };
    }
    // Admin check - assuming identity.roles is an array of strings
    const roles = (identity as any).roles;
    const isAdmin = Array.isArray(roles) && roles.includes("admin");
    if (!isAdmin) {
      return { success: false, message: "Admin access required." };
    }

    console.log("Fetching system pool stats (admin-only)");

    // 1. Get latest pool_metrics for each token
    const allTokensWithMetrics = await ctx.db.query("pool_metrics").collect();
    const latestMetricsByToken: Record<string, Doc<"pool_metrics">> = {};
    for (const metric of allTokensWithMetrics) {
      if (!latestMetricsByToken[metric.token] || metric.timestamp > latestMetricsByToken[metric.token]!.timestamp) {
        latestMetricsByToken[metric.token] = metric;
      }
    }

    let overallTVLApprox = 0;
    let overallAvailableApprox = 0;
    let overallLockedApprox = 0;
    Object.values(latestMetricsByToken).forEach(m => {
      overallTVLApprox += m.total_liquidity; // Note: This is sum of token amounts, not USD value
      overallAvailableApprox += m.available_liquidity;
      overallLockedApprox += m.locked_liquidity;
    });

    // 2. Count unique providers
    const allProviderBalanceEntries = await ctx.db.query("provider_balances").collect();
    const uniqueProviders = new Set(allProviderBalanceEntries.map(pb => pb.provider));
    const totalUniqueProviders = uniqueProviders.size;

    // 3. Count total pool transactions (can be very large, consider filtering or sampling for prod)
    // For simplicity, just getting total count. A more advanced version might filter by recent period.
    const totalPoolTransactions = (await ctx.db.query("pool_transactions").collect()).length;
    
    // 4. Count total active policy allocations
    const activeAllocations = await ctx.db.query("policy_allocations")
                                     .filter(q => q.eq(q.field("status"), AllocationStatus.ACTIVE))
                                     .collect();
    const totalActivePolicyAllocations = activeAllocations.length;

    return {
      success: true,
      stats: {
        totalTokensTrackedInMetrics: Object.keys(latestMetricsByToken).length,
        overallTVLApproximation: overallTVLApprox,
        overallAvailableLiquidityApproximation: overallAvailableApprox,
        overallLockedLiquidityApproximation: overallLockedApprox,
        latestMetricsByToken: latestMetricsByToken,
        totalUniqueProviders: totalUniqueProviders,
        totalPoolTransactions: totalPoolTransactions,
        totalActivePolicyAllocations: totalActivePolicyAllocations,
      },
    };
  },
});


// CV-LP-232: Implement pausePoolOperations action (admin-only)

const POOL_STATUS_SINGLETON_ID = "global" as const;

// Internal query to get the current pool operational status
export const getPoolPausedState = internalQuery({
  args: {},
  handler: async (ctx):
    Promise<Doc<"pool_status"> | null> => {
    return await ctx.db
      .query("pool_status") // Assumes 'pool_status' table exists
      .withIndex("by_singleton_id", q => q.eq("singletonId", POOL_STATUS_SINGLETON_ID))
      .unique();
  },
});

// Internal mutation to update the pool's operational status
export const updatePoolPausedState = internalMutation({
  args: {
    isDepositsPaused: v.optional(v.boolean()),
    isWithdrawalsPaused: v.optional(v.boolean()),
    isNewAllocationsPaused: v.optional(v.boolean()),
    pausedReason: v.optional(v.string()),
    adminPrincipal: v.string(),
  },
  handler: async (ctx, args) => {
    let existingStatus = await ctx.db
      .query("pool_status")
      .withIndex("by_singleton_id", q => q.eq("singletonId", POOL_STATUS_SINGLETON_ID))
      .unique();

    const updates: Partial<Doc<"pool_status">> = { lastUpdated: Date.now(), updatedBy: args.adminPrincipal };
    if (args.isDepositsPaused !== undefined) updates.isDepositsPaused = args.isDepositsPaused;
    if (args.isWithdrawalsPaused !== undefined) updates.isWithdrawalsPaused = args.isWithdrawalsPaused;
    if (args.isNewAllocationsPaused !== undefined) updates.isNewAllocationsPaused = args.isNewAllocationsPaused;
    if (args.pausedReason !== undefined) updates.pausedReason = args.pausedReason;
    // If reason is being cleared, explicitly set to undefined or null if schema allows
    else if (args.pausedReason === null) updates.pausedReason = undefined; 


    if (existingStatus) {
      await ctx.db.patch(existingStatus._id, updates);
    } else {
      // Initialize with defaults if not explicitly set to pause, and ensure all required fields are present for insert.
      await ctx.db.insert("pool_status", {
        singletonId: POOL_STATUS_SINGLETON_ID,
        isDepositsPaused: args.isDepositsPaused ?? false,
        isWithdrawalsPaused: args.isWithdrawalsPaused ?? false,
        isNewAllocationsPaused: args.isNewAllocationsPaused ?? false,
        pausedReason: args.pausedReason, // This is optional in schema, so undefined is fine if not provided in args
        lastUpdated: Date.now(), // Required, so explicitly set
        updatedBy: args.adminPrincipal, // Required, so explicitly set
      });
    }
    return await ctx.db.query("pool_status").withIndex("by_singleton_id", q => q.eq("singletonId", POOL_STATUS_SINGLETON_ID)).unique();
  },
});

interface PausePoolOperationsResult {
  success: boolean;
  message: string;
  newStatus?: Doc<"pool_status"> | null;
}

export const pausePoolOperations = action({
  args: {
    pauseDeposits: v.optional(v.boolean()),
    pauseWithdrawals: v.optional(v.boolean()),
    pauseNewAllocations: v.optional(v.boolean()),
    reason: v.optional(v.string()), // Reason for pausing/unpausing
  },
  handler: async (ctx, args): Promise<PausePoolOperationsResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.tokenIdentifier) {
      return { success: false, message: "Authentication required." };
    }
    const adminPrincipal = identity.tokenIdentifier;

    const roles = (identity as any).roles;
    const isAdmin = Array.isArray(roles) && roles.includes("admin");
    if (!isAdmin) {
      return { success: false, message: "Admin access required." };
    }

    if (Object.keys(args).length === 0) {
        return { success: false, message: "No operations specified to pause/unpause." };
    }

    console.log(`Admin ${adminPrincipal} attempting to update pool operations status:`, args);

    try {
      const newStatus = await ctx.runMutation(internal.liquidityPool.adminOperations.updatePoolPausedState, {
        isDepositsPaused: args.pauseDeposits,
        isWithdrawalsPaused: args.pauseWithdrawals,
        isNewAllocationsPaused: args.pauseNewAllocations,
        pausedReason: args.reason,
        adminPrincipal: adminPrincipal,
      });
      return { success: true, message: "Pool operational status updated successfully.", newStatus };
    } catch (error: any) {
      console.error(`Error updating pool operational status by admin ${adminPrincipal}:`, error);
      return { success: false, message: `Error updating status: ${error.message}` };
    }
  },
}); 
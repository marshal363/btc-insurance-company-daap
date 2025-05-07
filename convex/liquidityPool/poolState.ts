import { query, internalAction, internalQuery, internalMutation, MutationCtx, QueryCtx, ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { AllocationStatus, PremiumDistributionStatus } from "./types";

// CV-LP-208: Get pool metrics for all tokens or a specific token.
export const getPoolMetrics = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args) => {
    let metricsQuery = ctx.db
      .query("pool_metrics")
      .order("desc");
    
    if (args.token) {
      metricsQuery = metricsQuery.filter(q => q.eq(q.field("token"), args.token));
    }
    
    const latestMetrics = await metricsQuery.collect();
    
    if (args.token) {
      const tokenMetrics = latestMetrics.find(m => m.token === args.token);
      return tokenMetrics || null;
    }
    
    const metricsByToken: Record<string, any> = {};
    for (const metric of latestMetrics) {
      if (!metricsByToken[metric.token] || 
          metric.timestamp > metricsByToken[metric.token].timestamp) {
        metricsByToken[metric.token] = metric;
      }
    }
    
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

export const getPoolMetricsHistory = query({
  args: {
    token: v.string(),
    timeframe: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    const limit = args.limit || 30;
    let timeframeMs = 24 * 60 * 60 * 1000;
    
    switch (args.timeframe.toLowerCase()) {
      case "hour": timeframeMs = 60 * 60 * 1000; break;
      case "day": timeframeMs = 24 * 60 * 60 * 1000; break;
      case "week": timeframeMs = 7 * 24 * 60 * 60 * 1000; break;
      case "month": timeframeMs = 30 * 24 * 60 * 60 * 1000; break;
      case "year": timeframeMs = 365 * 24 * 60 * 60 * 1000; break;
    }
    
    const startTime = Date.now() - (timeframeMs * limit);
    const metrics = await ctx.db
      .query("pool_metrics")
      .filter(q => 
        q.eq(q.field("token"), args.token) &&
        q.gte(q.field("timestamp"), startTime)
      )
      .order("asc")
      .collect();
    
    const buckets: Record<number, any> = {};
    for (const metric of metrics) {
      const bucketTime = Math.floor(metric.timestamp / timeframeMs) * timeframeMs;
      if (!buckets[bucketTime] || metric.timestamp > buckets[bucketTime].timestamp) {
        buckets[bucketTime] = metric;
      }
    }
    
    const result = Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
    return result.slice(-limit);
  }
});

function calculateAnnualizedYield(
  totalEarned: number,
  totalLiquidity: number,
  avgDurationDays: number
): number {
  if (totalLiquidity <= 0 || avgDurationDays <= 0) {
    return 0;
  }
  const yieldRate = totalEarned / totalLiquidity;
  const annualizedYield = yieldRate * (365 / avgDurationDays) * 100;
  return annualizedYield;
}

export const getProviderBalancesForToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => { // Added QueryCtx
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
  handler: async (ctx: QueryCtx, args): Promise<number> => { // Added QueryCtx
    const activeAllocations = await ctx.db
      .query("policy_allocations")
      .filter(q => 
        q.eq(q.field("token"), args.token) && 
        q.eq(q.field("status"), AllocationStatus.ACTIVE) // Used Enum
      )
      .collect();
    
    const policyIds = new Set(activeAllocations.map((a: Doc<"policy_allocations">) => a.policy_id));
    return policyIds.size;
  },
});

export const getPremiumStatsForToken = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => { // Added QueryCtx
    const premiumBalance = await ctx.db
      .query("premium_balances")
      .filter(q => q.eq(q.field("token"), args.token))
      .unique();
    
    if (!premiumBalance) {
      return {
        totalCollected: 0,
        totalDistributed: 0,
        totalEarned: 0,
        avgDuration: 30, 
      };
    }
    
    const distributions = await ctx.db
      .query("provider_premium_distributions")
      .filter(q => 
        q.eq(q.field("token"), args.token) && 
        q.eq(q.field("status"), PremiumDistributionStatus.COMPLETED) // Used Enum
      )
      .collect();
    
    const totalEarned = distributions.reduce(
      (sum, d) => sum + d.premium_amount, 0
    );
    const avgDuration = 30; 
    
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
  handler: async (ctx: MutationCtx, args) => { // Added MutationCtx
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

export const updatePoolMetrics = internalAction({
  args: {
    token: v.string(),
  },
  handler: async (ctx: ActionCtx, args) => { // Added ActionCtx
    const balances: Doc<"provider_balances">[] = await ctx.runQuery(internal.liquidityPool.poolState.getProviderBalancesForToken, { // Adjusted path
      token: args.token,
    });
    
    const totalLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.total_deposited, 0);
    const availableLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.available_balance, 0);
    const lockedLiquidity = balances.reduce((sum: number, b: Doc<"provider_balances">) => sum + b.locked_balance, 0);
    
    const providerSet = new Set(balances.map((b: Doc<"provider_balances">) => b.provider));
    const totalProviders = providerSet.size;
    
    const activePolicies = await ctx.runQuery(internal.liquidityPool.poolState.getActivePolicyCountForToken, { // Adjusted path
      token: args.token,
    });
    
    const utilizationRate = totalLiquidity > 0 
      ? (lockedLiquidity / totalLiquidity) * 100 
      : 0;
    
    const premiumStats = await ctx.runQuery(internal.liquidityPool.poolState.getPremiumStatsForToken, { // Adjusted path
      token: args.token,
    });
    
    const annualizedYield = calculateAnnualizedYield(
      premiumStats.totalEarned,
      totalLiquidity,
      premiumStats.avgDuration
    );
    
    await ctx.runMutation(internal.liquidityPool.poolState.updatePoolMetricsRecord, { // Adjusted path
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
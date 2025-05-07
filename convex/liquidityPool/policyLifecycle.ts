import { action, internalAction, internalMutation, internalQuery, query, DatabaseReader } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { Id, Doc, DataModel } from "../_generated/dataModel";
import { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { AllocationStatus, TransactionType, TransactionStatus } from "./types";

// Define expected return types for internal functions to help with type inference
export interface PolicyAllocationResult {
  _id: Id<"policy_allocations">;
  policyId: Id<"policies">;
  provider: string;
  amount: number;
  token: string;
  status: string;
  createdAt: number;
  allocation_percentage: number;
  premium_share: number;
  premium_distributed: boolean;
}

interface EligibleProvider {
  provider: string;
  availableBalance: number;
}

interface AllocationToMake {
  provider: string;
  amount: number;
}

interface AllocateCapitalResult {
  policyId: string;
  totalAmount: number;
  token: string;
  providerCount: number;
  allocationIds: Id<"policy_allocations">[];
}

interface ReleaseCollateralResult {
  policyId: string;
  reason?: string;
  message?: string;
  releasedCount: number;
  totalCount?: number;
}

/**
 * Get allocations for a specific policy
 * 
 * @param policyId Policy ID to get allocations for
 * @returns Array of policy allocations with provider and amount details
 */
export const getPolicyAllocations = internalQuery({
  args: {
    policyId: v.string(),
  },
  handler: async (ctx: QueryCtx, args): Promise<PolicyAllocationResult[]> => {
    const allocations = await ctx.db
      .query("policy_allocations")
      .filter(q => q.eq(q.field("policy_id"), args.policyId as Id<"policies">))
      .collect();
    
    return allocations.map(alloc => ({
      _id: alloc._id,
      policyId: alloc.policy_id,
      provider: alloc.provider,
      amount: alloc.allocated_amount,
      token: alloc.token,
      status: alloc.status,
      createdAt: alloc.allocation_timestamp,
      allocation_percentage: alloc.allocation_percentage,
      premium_share: alloc.premium_share,
      premium_distributed: alloc.premium_distributed,
    }));
  },
});

/**
 * Allocate capital from liquidity providers for a new policy
 * 
 * @param policyId Unique policy identifier
 * @param amount Total collateral amount required
 * @param token Token type (e.g., "STX", "sBTC")
 * @param insuredAmount Amount insured by the policy
 * @param premiumAmount Premium amount paid for the policy
 * @returns Result object with allocations and providers involved
 */
export const allocateCapitalForPolicy = internalAction({
  args: {
    policyId: v.string(),
    amount: v.number(),
    token: v.string(),
    insuredAmount: v.number(),
    premiumAmount: v.number(),
  },
  handler: async (ctx: ActionCtx, args): Promise<AllocateCapitalResult> => {
    if (args.amount <= 0) {
      throw new Error("Allocation amount must be greater than zero");
    }
    
    const eligibleProviders: EligibleProvider[] = await ctx.runQuery(
      internal.liquidityPool.policyLifecycle.getEligibleProvidersForAllocation,
      { token: args.token, requiredAmount: args.amount }
    );
    
    if (eligibleProviders.length === 0) {
      throw new Error(`No eligible providers with sufficient available balance for ${args.token}`);
    }
    
    const allocationsToMake = await determineAllocationStrategy(
      eligibleProviders,
      args.amount,
      args.token
    );
    
    if (!allocationsToMake || allocationsToMake.length === 0) {
      throw new Error("Failed to determine allocation strategy or no allocations possible.");
    }
    
    const allocationIds: Id<"policy_allocations">[] = await ctx.runMutation(
      internal.liquidityPool.policyLifecycle.createPolicyAllocations,
      { policyId: args.policyId, allocations: allocationsToMake, token: args.token }
    );
    
    for (const allocation of allocationsToMake) {
      await ctx.runMutation(
        internal.liquidityPool.policyLifecycle.logAllocationTransaction,
        { provider: allocation.provider, policyId: args.policyId, amount: allocation.amount, token: args.token }
      );
    }
    
    return {
      policyId: args.policyId,
      totalAmount: args.amount,
      token: args.token,
      providerCount: allocationsToMake.length,
      allocationIds: allocationIds,
    };
  },
});

/**
 * Get providers eligible for capital allocation based on available balance
 */
export const getEligibleProvidersForAllocation = internalQuery({
  args: {
    token: v.string(),
    requiredAmount: v.number(),
  },
  handler: async (ctx: QueryCtx, args): Promise<EligibleProvider[]> => {
    const providers = await ctx.db
      .query("provider_balances")
      .filter(q => q.eq(q.field("token"), args.token) && q.gt(q.field("available_balance"), 0))
      .collect();
    
    const totalAvailable = providers.reduce((sum, p) => sum + p.available_balance, 0);
    if (totalAvailable < args.requiredAmount) return [];
    
    return providers.map(p => ({ provider: p.provider, availableBalance: p.available_balance }));
  },
});

/**
 * Determine allocation strategy for a policy
 * Helper function that implements policy allocation algorithm
 */
async function determineAllocationStrategy(
  eligibleProviders: EligibleProvider[],
  totalRequiredAmount: number,
  token: string
): Promise<AllocationToMake[]> {
  const sortedProviders = [...eligibleProviders].sort((a, b) => b.availableBalance - a.availableBalance);
  const allocations: AllocationToMake[] = [];
  let remainingAmount = totalRequiredAmount;
  const totalAvailableAmongEligible = sortedProviders.reduce((sum, p) => sum + p.availableBalance, 0);

  if (totalAvailableAmongEligible === 0 && totalRequiredAmount > 0) {
    if (totalRequiredAmount > 0) {
        console.warn(`No available balance among eligible providers to allocate for token ${token} with required amount ${totalRequiredAmount}`);
        return [];
    }
    return [];
  }
  if (totalRequiredAmount === 0) return [];

  for (const provider of sortedProviders) {
    if (remainingAmount <= 0) break;
    const proportion = totalAvailableAmongEligible > 0 ? provider.availableBalance / totalAvailableAmongEligible : 0;
    let allocationAmount = Math.floor(totalRequiredAmount * proportion);
    allocationAmount = Math.min(allocationAmount, provider.availableBalance);
    allocationAmount = Math.min(allocationAmount, remainingAmount);

    if (allocationAmount > 0) {
      allocations.push({ provider: provider.provider, amount: allocationAmount });
      remainingAmount -= allocationAmount;
    }
  }

  if (remainingAmount > 0) {
    for (const provider of sortedProviders) {
      if (remainingAmount <= 0) break;
      const existingAllocationEntry = allocations.find(a => a.provider === provider.provider);
      const currentlyAllocatedToProvider = existingAllocationEntry ? existingAllocationEntry.amount : 0;
      const canAllocateMore = provider.availableBalance - currentlyAllocatedToProvider;

      if (canAllocateMore > 0) {
        const additionalAmount = Math.min(remainingAmount, canAllocateMore);
        if (existingAllocationEntry) {
          existingAllocationEntry.amount += additionalAmount;
        } else {
          allocations.push({ provider: provider.provider, amount: additionalAmount });
        }
        remainingAmount -= additionalAmount;
      }
    }
  }

  if (remainingAmount > 0) {
    console.warn(`Failed to allocate full amount for token ${token}. Remaining: ${remainingAmount}`);
  }
  return allocations;
}

/**
 * Create policy allocations in the database
 * Records allocation of provider capital to a policy
 */
export const createPolicyAllocations = internalMutation({
  args: {
    policyId: v.string(),
    allocations: v.array(v.object({ provider: v.string(), amount: v.number() })),
    token: v.string(),
  },
  handler: async (ctx: MutationCtx, args): Promise<Id<"policy_allocations">[]> => {
    const allocationIds: Id<"policy_allocations">[] = [];
    for (const allocToMake of args.allocations) {
      const allocationId = await ctx.db.insert("policy_allocations", {
        policy_id: args.policyId as Id<"policies">,
        provider: allocToMake.provider,
        allocated_amount: allocToMake.amount,
        token: args.token,
        status: AllocationStatus.ACTIVE,
        allocation_timestamp: Date.now(),
        allocation_percentage: 0, 
        premium_share: 0, 
        premium_distributed: false,
      });
      
      const balance = await ctx.db.query("provider_balances")
        .filter(q => q.eq(q.field("provider"), allocToMake.provider) && q.eq(q.field("token"), args.token))
        .unique();
      
      if (!balance) throw new Error(`Provider balance not found: ${allocToMake.provider}, ${args.token}`);
      if (balance.available_balance < allocToMake.amount) {
        throw new Error(`Insufficient balance for ${allocToMake.provider}: Has ${balance.available_balance}, Needs ${allocToMake.amount}`);
      }
      
      await ctx.db.patch(balance._id, {
        available_balance: balance.available_balance - allocToMake.amount,
        locked_balance: balance.locked_balance + allocToMake.amount,
      });
      allocationIds.push(allocationId);
    }
    return allocationIds;
  },
});

/**
 * Log allocation transaction for a provider
 * Records the event in the provider's transaction history
 */
export const logAllocationTransaction = internalMutation({
  args: {
    provider: v.string(),
    policyId: v.string(),
    amount: v.number(),
    token: v.string(),
  },
  handler: async (ctx: MutationCtx, args): Promise<Id<"pool_transactions">> => {
    const txId = `alloc-${args.policyId}-${Date.now()}`;
    return await ctx.db.insert("pool_transactions", {
      provider: args.provider,
      tx_id: txId,
      tx_type: TransactionType.ALLOCATION,
      amount: args.amount,
      token: args.token,
      timestamp: Date.now(),
      status: TransactionStatus.CONFIRMED,
      description: `Allocated ${args.amount} ${args.token} to policy ${args.policyId}`,
      metadata: { policy_id: args.policyId },
    });
  },
});

/**
 * Release collateral when a policy expires, is canceled, or gets exercised
 * 
 * @param policyId Policy ID to release allocations for
 * @param reason Reason for release (EXPIRED, CANCELLED, EXERCISED)
 * @returns Result with released allocations summary
 */
export const releaseCollateral = internalAction({
  args: {
    policyId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx: ActionCtx, args): Promise<ReleaseCollateralResult> => {
    const validReasons = ["EXPIRED", "CANCELLED", "EXERCISED"];
    if (!validReasons.includes(args.reason)) {
      throw new Error(`Invalid release reason: ${args.reason}. Must be one of: ${validReasons.join(", ")}`);
    }
    
    const allocationsFromDb = await ctx.runQuery(
      internal.liquidityPool.policyLifecycle.getPolicyAllocations,
      { policyId: args.policyId }
    );
    
    if (allocationsFromDb.length === 0) {
      return { policyId: args.policyId, reason: args.reason, message: `No allocations found for policy ${args.policyId}.`, releasedCount: 0, totalCount: 0 };
    }
    
    const activeAllocations = allocationsFromDb.filter(a => a.status === AllocationStatus.ACTIVE);
    if (activeAllocations.length === 0) {
      return { policyId: args.policyId, reason: args.reason, message: "Allocations already released or not in active state.", releasedCount: 0, totalCount: allocationsFromDb.length };
    }
    
    const releasedAllocationsInfo: PolicyAllocationResult[] = [];
    for (const alloc of activeAllocations) {
      try {
        await ctx.runMutation(
          internal.liquidityPool.policyLifecycle.releaseAllocationCollateral,
          { allocationId: alloc._id, reason: args.reason }
        );
        await ctx.runMutation(
          internal.liquidityPool.policyLifecycle.logCollateralReleaseTransaction,
          { provider: alloc.provider, policyId: String(alloc.policyId), amount: alloc.amount, token: alloc.token, reason: args.reason }
        );
        releasedAllocationsInfo.push(alloc);
      } catch (error: any) {
        console.error(`Error releasing allocation ${alloc._id} for policy ${args.policyId}: ${(error as Error).message}.`);
      }
    }
    
    if (releasedAllocationsInfo.length > 0) {
      const token = releasedAllocationsInfo[0].token;
      await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, { token });
    }
    
    return {
      policyId: args.policyId,
      reason: args.reason,
      releasedCount: releasedAllocationsInfo.length,
      totalCount: activeAllocations.length,
      message: releasedAllocationsInfo.length === activeAllocations.length ? "All active allocations released." : "Some allocations failed."
    };
  },
});

/**
 * Release a specific allocation's collateral
 * Updates allocation status and provider balances
 */
export const releaseAllocationCollateral = internalMutation({
  args: {
    allocationId: v.id("policy_allocations"),
    reason: v.string(),
  },
  handler: async (ctx: MutationCtx, args): Promise<{ success: boolean; message?: string; status?: string; allocationId?: Id<"policy_allocations">; reason?: string; }> => {
    const allocationRecord = await ctx.db.get(args.allocationId);
    if (!allocationRecord) throw new Error(`Allocation not found: ${args.allocationId}`);
    
    if (allocationRecord.status !== AllocationStatus.ACTIVE) {
      return { success: false, message: "Allocation not active.", status: allocationRecord.status, allocationId: args.allocationId, reason: args.reason };
    }
    
    let newStatus: AllocationStatus;
    if (args.reason === "EXERCISED") newStatus = AllocationStatus.EXERCISED;
    else if (args.reason === "CANCELLED") newStatus = AllocationStatus.CANCELLED;
    else if (args.reason === "EXPIRED") newStatus = AllocationStatus.EXPIRED;
    else {
      console.warn(`Unknown release reason: ${args.reason}. Defaulting to CANCELLED.`);
      newStatus = AllocationStatus.CANCELLED;
    }

    await ctx.db.patch(args.allocationId, { status: newStatus });
    
    const balance = await ctx.db.query("provider_balances")
      .filter(q => q.eq(q.field("provider"), allocationRecord.provider) && q.eq(q.field("token"), allocationRecord.token))
      .unique();
      
    if (!balance) throw new Error(`Prov balance not found: ${allocationRecord.provider}, ${allocationRecord.token}`);
    
    if (args.reason === "EXERCISED") {
      await ctx.db.patch(balance._id, {
        locked_balance: Math.max(0, balance.locked_balance - allocationRecord.allocated_amount),
      });
    } else {
      await ctx.db.patch(balance._id, {
        locked_balance: Math.max(0, balance.locked_balance - allocationRecord.allocated_amount),
        available_balance: balance.available_balance + allocationRecord.allocated_amount,
      });
    }
    
    return { success: true, allocationId: args.allocationId, reason: args.reason, status: newStatus };
  },
});

/**
 * Log collateral release transaction for a provider
 * Records the event in the provider's transaction history
 */
export const logCollateralReleaseTransaction = internalMutation({
  args: {
    provider: v.string(),
    policyId: v.string(),
    amount: v.number(),
    token: v.string(),
    reason: v.string(),
  },
  handler: async (ctx: MutationCtx, args): Promise<Id<"pool_transactions">> => {
    const txId = `release-${args.policyId}-${Date.now()}`;
    const txType: TransactionType = TransactionType.COLLATERAL_RELEASE;
    let description = `Released ${args.amount} ${args.token} from policy ${args.policyId} (${args.reason.toLowerCase()})`;
    if (args.reason === "EXERCISED") {
      description = `Exercised ${args.amount} ${args.token} from policy ${args.policyId}`;
    }
    
    return await ctx.db.insert("pool_transactions", {
      provider: args.provider,
      tx_id: txId,
      tx_type: txType,
      amount: args.amount,
      token: args.token,
      timestamp: Date.now(),
      status: TransactionStatus.CONFIRMED,
      description,
      metadata: { policy_id: args.policyId, reason: args.reason },
    });
  },
}); 
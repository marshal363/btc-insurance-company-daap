import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Enum for reconciliation status values
 */
export enum ReconciliationStatus {
  NEEDED = "Needed",
  IN_PROGRESS = "InProgress",
  COMPLETED = "Completed",
  FAILED = "Failed",
}

/**
 * Enum for reconciliation event types
 */
export enum ReconciliationEventType {
  RECONCILIATION_STARTED = "ReconciliationStarted",
  RECONCILIATION_COMPLETED = "ReconciliationCompleted",
  RECONCILIATION_FAILED = "ReconciliationFailed",
  POLICY_STATE_UPDATED = "PolicyStateUpdated",
}

/**
 * Interface for on-chain policy state
 */
interface OnChainPolicyState {
  policyId: string;
  owner: string;
  status: string;
  expirationHeight: number;
  settlementAmount?: number;
  isActive: boolean;
  isSettled: boolean;
  isExpired: boolean;
}

/**
 * Mock function to get on-chain policy state.
 * This is a placeholder until actual blockchain integration is implemented.
 * 
 * @param onChainPolicyId The on-chain ID of the policy
 * @returns Promise with the on-chain policy state
 */
export const mockGetOnChainPolicyState = async (
  onChainPolicyId: string
): Promise<OnChainPolicyState | null> => {
  console.log(`Fetching on-chain state for policy: ${onChainPolicyId}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // 5% chance of failing to retrieve data
  if (Math.random() < 0.05) {
    console.warn(`Failed to retrieve on-chain state for policy: ${onChainPolicyId}`);
    return null;
  }
  
  // Simulate varied on-chain state
  const randomScenario = Math.random();
  
  // Build a mock policy state based on the random scenario
  return {
    policyId: onChainPolicyId,
    owner: `ST1${Math.random().toString(36).substring(2, 12)}`,
    status: randomScenario < 0.6 ? "active" : (randomScenario < 0.8 ? "exercised" : "expired"),
    expirationHeight: Math.floor(700000 + Math.random() * 5000),
    settlementAmount: randomScenario < 0.3 ? Math.floor(Math.random() * 1000000) : undefined,
    isActive: randomScenario < 0.6,
    isSettled: randomScenario >= 0.6 && randomScenario < 0.8,
    isExpired: randomScenario >= 0.8,
  };
};

/**
 * Helper query to get all policies that need reconciliation.
 * This typically includes:
 * 1. Policies that have on-chain IDs but haven't been checked recently
 * 2. Policies with inconsistencies flagged by other processes
 */
export const getPoliciesForReconciliation = internalQuery({
  handler: async (ctx): Promise<Doc<"policies">[]> => {
    // Get all policies with onChainPolicyId that haven't been reconciled recently
    // In a real implementation, this would be limited by a "lastReconciled" timestamp
    // Example: .filter(q => q.eq(q.field("lastReconciled"), undefined))
    // or .filter(q => q.lt(q.field("lastReconciled"), someTimestamp))
    return await ctx.db
      .query("policies")
      .filter(q => q.neq(q.field("onChainPolicyId"), undefined))
      .take(50); // Limit the number of policies to reconcile in one job run
  }
});

/**
 * Updates a policy's state based on on-chain data.
 */
export const reconcilePolicyState = internalMutation({
  args: {
    policyId: v.id("policies"),
    onChainState: v.object({
      status: v.string(),
      expirationHeight: v.number(),
      settlementAmount: v.optional(v.number()),
      isActive: v.boolean(),
      isSettled: v.boolean(),
      isExpired: v.boolean(),
    }),
    reconciliationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${args.policyId}`);
    }
    
    // Map on-chain status to our policy status enum
    let newStatus = policy.status; // Default to current status
    
    if (args.onChainState.isExpired) {
      newStatus = "Expired";
    } else if (args.onChainState.isSettled) {
      newStatus = "Exercised";
    } else if (args.onChainState.isActive) {
      newStatus = "Active";
    }
    
    // Only update if there's a change
    if (newStatus !== policy.status) {
      // Update policy status
      await ctx.db.patch(args.policyId, {
        status: newStatus,
        updatedAt: Date.now(),
      });
      
      // Create policy event for state update
      await ctx.db.insert("policyEvents", {
        policyConvexId: args.policyId,
        eventType: "ReconciliationUpdate",
        data: {
          previousStatus: policy.status,
          newStatus: newStatus,
          onChainState: args.onChainState,
          reconciliationId: args.reconciliationId,
          reconciliationTimestamp: Date.now()
        },
        timestamp: Date.now(),
      });
      
      console.log(`Reconciled policy ${args.policyId}: Status updated from ${policy.status} to ${newStatus}`);
    } else {
      console.log(`Reconciled policy ${args.policyId}: No status change needed`);
    }
    
    // Update settlement amount if provided and different
    if (args.onChainState.settlementAmount !== undefined && 
        (policy as any).settlementAmount !== args.onChainState.settlementAmount) {
      await ctx.db.patch(args.policyId, {
        settlementAmount: args.onChainState.settlementAmount,
      });
    }
    
    // Update expiration height if different
    if (policy.expirationHeight !== args.onChainState.expirationHeight) {
      await ctx.db.patch(args.policyId, {
        expirationHeight: args.onChainState.expirationHeight,
      });
    }
    
    return await ctx.db.get(args.policyId);
  }
});

/**
 * Scheduled job to auto-reconcile on-chain vs off-chain policy states.
 * Implements CV-PR-215 from the implementation roadmap.
 * 
 * This job:
 * 1. Queries policies that need reconciliation
 * 2. Fetches their on-chain state
 * 3. Updates policy records in Convex based on on-chain state
 * 
 * @returns Summary of reconciled policies
 */
export const autoReconciliationJob = internalAction({
  handler: async (ctx): Promise<{
    policiesChecked: number;
    policiesUpdated: number;
    policiesFailed: number;
  }> => {
    console.log("Running scheduled job: autoReconciliationJob");
    
    // Create a unique reconciliation ID for this job run
    const reconciliationId = `recon-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Track stats for reporting
    const stats = {
      policiesChecked: 0,
      policiesUpdated: 0,
      policiesFailed: 0,
    };
    
    try {
      // 1. Query policies that need reconciliation
      const policiesToReconcile = await ctx.runQuery(internal.reconciliationJobs.getPoliciesForReconciliation, {});
      
      stats.policiesChecked = policiesToReconcile.length;
      console.log(`Found ${policiesToReconcile.length} policies for reconciliation`);
      
      // 2. Process each policy
      for (const policy of policiesToReconcile) {
        try {
          // Skip policies without on-chain ID
          if (!policy.onChainPolicyId) {
            console.log(`Skipping policy ${policy._id}: No on-chain ID`);
            continue;
          }
          
          // Get on-chain state
          const onChainState = await mockGetOnChainPolicyState(policy.onChainPolicyId);
          
          if (!onChainState) {
            console.warn(`Failed to get on-chain state for policy ${policy._id} (${policy.onChainPolicyId})`);
            stats.policiesFailed++;
            continue;
          }
          
          // Reconcile policy state
          await ctx.runMutation(internal.reconciliationJobs.reconcilePolicyState, {
            policyId: policy._id,
            onChainState: {
              status: onChainState.status,
              expirationHeight: onChainState.expirationHeight,
              settlementAmount: onChainState.settlementAmount,
              isActive: onChainState.isActive,
              isSettled: onChainState.isSettled,
              isExpired: onChainState.isExpired,
            },
            reconciliationId,
          });
          
          stats.policiesUpdated++;
          
        } catch (error: any) {
          console.error(`Error reconciling policy ${policy._id}:`, error);
          stats.policiesFailed++;
        }
      }
      
      console.log(`Completed policy reconciliation: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error: any) {
      console.error("Error in autoReconciliationJob:", error);
      return stats;
    }
  }
}); 
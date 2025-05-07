import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Enum for settlement status
 */
export enum SettlementStatus {
  REQUESTED = "Requested",
  PROCESSING = "Processing",
  COMPLETED = "Completed",
  FAILED = "Failed",
}

/**
 * Enum for policy event types related to settlement
 */
export enum SettlementEventType {
  SETTLEMENT_REQUESTED = "SettlementRequested",
  SETTLEMENT_PROCESSING = "SettlementProcessing",
  SETTLEMENT_COMPLETED = "SettlementCompleted",
  SETTLEMENT_FAILED = "SettlementFailed",
}

/**
 * Mock function to simulate settlement processing with a blockchain.
 * This would eventually be replaced with real blockchain integration.
 * 
 * @param settlementId The ID of the settlement to process
 * @param amount The amount to settle
 * @returns Object with settlement status information
 */
export const mockProcessSettlement = async (
  settlementId: string,
  amount: number
): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> => {
  console.log(`Processing settlement ${settlementId} for amount ${amount}`);
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 90% success rate for testing
  if (Math.random() < 0.9) {
    return {
      success: true,
      transactionId: `tx-${Math.random().toString(36).substring(2, 10)}`
    };
  } else {
    return {
      success: false,
      error: "Mock settlement processing failed"
    };
  }
};

/**
 * Helper query to find policies that need settlement processing.
 * Returns policies that have been exercised but not yet settled.
 */
export const getPoliciesForSettlement = internalQuery({
  handler: async (ctx): Promise<Doc<"policies">[]> => {
    // Query for exercised policies that need settlement
    return await ctx.db
      .query("policies")
      .filter(q => 
        q.and(
          q.eq(q.field("status"), "Exercised"),
          // Only include policies where settlementProcessed is false or missing
          q.or(
            q.eq(q.field("settlementProcessed"), false),
            q.eq(q.field("settlementProcessed"), undefined)
          )
        )
      )
      .take(100); // Limit number of policies to process
  }
});

/**
 * Updates the settlement status for a policy.
 */
export const updateSettlementStatus = internalMutation({
  args: {
    policyId: v.id("policies"),
    settlementStatus: v.string(),
    transactionId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${args.policyId}`);
    }
    
    const updateData: any = {
      settlementStatus: args.settlementStatus,
      updatedAt: Date.now(),
    };
    
    if (args.settlementStatus === SettlementStatus.COMPLETED) {
      updateData.settlementProcessed = true;
      updateData.settlementCompletedAt = Date.now();
    }
    
    if (args.transactionId) {
      updateData.settlementTransactionId = args.transactionId;
    }
    
    if (args.error) {
      updateData.settlementError = args.error;
    }
    
    await ctx.db.patch(args.policyId, updateData);
    
    // Create a settlement event
    let eventType;
    switch (args.settlementStatus) {
      case SettlementStatus.REQUESTED:
        eventType = SettlementEventType.SETTLEMENT_REQUESTED;
        break;
      case SettlementStatus.PROCESSING:
        eventType = SettlementEventType.SETTLEMENT_PROCESSING;
        break;
      case SettlementStatus.COMPLETED:
        eventType = SettlementEventType.SETTLEMENT_COMPLETED;
        break;
      case SettlementStatus.FAILED:
        eventType = SettlementEventType.SETTLEMENT_FAILED;
        break;
      default:
        eventType = SettlementEventType.SETTLEMENT_REQUESTED;
    }
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: args.policyId,
      eventType,
      data: {
        settlementStatus: args.settlementStatus,
        transactionId: args.transactionId,
        error: args.error,
      },
      timestamp: Date.now(),
    });
    
    return await ctx.db.get(args.policyId);
  }
});

/**
 * Scheduled job to process settlements for exercised policies.
 * Implements CV-PR-214 from the implementation roadmap.
 * 
 * This job:
 * 1. Queries exercised policies that need settlement
 * 2. Processes each settlement via mock blockchain integration
 * 3. Updates policy and settlement status
 * 
 * @returns Summary of processed settlements
 */
export const processSettlementsJob = internalAction({
  handler: async (ctx): Promise<{
    policiesProcessed: number;
    settlementSuccesses: number;
    settlementFailures: number;
  }> => {
    console.log("Running scheduled job: processSettlementsJob");
    
    // Track stats for reporting
    const stats = {
      policiesProcessed: 0,
      settlementSuccesses: 0,
      settlementFailures: 0,
    };
    
    try {
      // 1. Query exercised policies that need settlement
      const policiesToSettle = await ctx.runQuery(internal.settlementJobs.getPoliciesForSettlement, {});
      
      stats.policiesProcessed = policiesToSettle.length;
      console.log(`Found ${policiesToSettle.length} policies for settlement processing`);
      
      // 2. Process each settlement
      for (const policy of policiesToSettle) {
        try {
          // Update status to Processing
          await ctx.runMutation(internal.settlementJobs.updateSettlementStatus, {
            policyId: policy._id,
            settlementStatus: SettlementStatus.PROCESSING,
          });
          
          // Process the settlement (mock for now)
          const settlementResult = await mockProcessSettlement(
            policy._id,
            (policy as any).settlementAmount || 0 // Using any casting since field might not exist in type
          );
          
          if (settlementResult.success) {
            // Settlement successful
            await ctx.runMutation(internal.settlementJobs.updateSettlementStatus, {
              policyId: policy._id,
              settlementStatus: SettlementStatus.COMPLETED,
              transactionId: settlementResult.transactionId,
            });
            stats.settlementSuccesses++;
          } else {
            // Settlement failed
            await ctx.runMutation(internal.settlementJobs.updateSettlementStatus, {
              policyId: policy._id,
              settlementStatus: SettlementStatus.FAILED,
              error: settlementResult.error,
            });
            stats.settlementFailures++;
          }
          
        } catch (error: any) {
          console.error(`Error processing settlement for policy ${policy._id}:`, error);
          
          // Update settlement status to Failed
          await ctx.runMutation(internal.settlementJobs.updateSettlementStatus, {
            policyId: policy._id,
            settlementStatus: SettlementStatus.FAILED,
            error: error.message || "Unknown error during settlement processing",
          });
          
          stats.settlementFailures++;
        }
      }
      
      console.log(`Completed settlement processing: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error: any) {
      console.error("Error in processSettlementsJob:", error);
      return stats;
    }
  }
}); 
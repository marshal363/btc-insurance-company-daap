import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server"; // For type safety in helpers
import { internal } from "../_generated/api"; // For calling other internal functions
import { TransactionStatus, PolicyStatus, PolicyEventType } from "./types";

/**
 * Internal mutation to create pending policy transaction record.
 */
export const createPendingPolicyTransaction = internalMutation({
  args: {
    actionType: v.string(),
    status: v.string(), // Should ideally use TransactionStatus enum type here, but Convex args might require simple types
    payload: v.any(),
    userId: v.string(),
    policyConvexId: v.optional(v.id("policies")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingPolicyTransactions", {
      actionType: args.actionType,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: args.payload,
      retryCount: 0,
      userId: args.userId,
      policyConvexId: args.policyConvexId,
    });
  },
});

/**
 * Handles follow-up actions when a policy creation transaction is confirmed.
 */
async function handleConfirmedPolicyCreation(ctx: MutationCtx, pendingTx: Doc<"pendingPolicyTransactions">, args: any): Promise<void> {
  console.log(`Handling confirmed policy creation for ${pendingTx._id}`);
  
  const params = pendingTx.payload.params;
  let policyIdToUseForEvents: Id<"policies"> | null = pendingTx.policyConvexId || null;
  
  try {
    const newlyCreatedPolicyId = await ctx.db.insert("policies", {
      owner: params.owner,
      counterparty: params.counterparty,
      protectedValue: params.protectedValueUSD,
      protectionAmount: params.protectionAmountBTC,
      premium: params.premiumUSD,
      creationTimestamp: Date.now(),
      expirationHeight: params.expirationHeight,
      status: PolicyStatus.ACTIVE, 
      policyType: params.policyType,
      positionType: params.positionType,
      onChainPolicyId: args.data?.onChainPolicyId || "mock-policy-id-" + Math.floor(Math.random() * 1000000),
      collateralToken: params.collateralToken,
      settlementToken: params.settlementToken,
      displayName: params.displayName || `${params.policyType} Option - ${params.protectedValueUSD} USD`,
      description: params.description,
      tags: params.tags,
      updatedAt: Date.now(),
      premiumPaid: true, 
      premiumDistributed: false, 
    });
    
    policyIdToUseForEvents = newlyCreatedPolicyId;
    console.log(`Created policy with ID: ${newlyCreatedPolicyId}`);
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: newlyCreatedPolicyId,
      eventType: PolicyEventType.CREATED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        params: params,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: newlyCreatedPolicyId,
      eventType: PolicyEventType.ONCHAIN_CONFIRMED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        blockHeight: args.data?.blockHeight,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
      blockHeight: args.data?.blockHeight,
    });
    
    await ctx.db.patch(pendingTx._id, {
      policyConvexId: newlyCreatedPolicyId, 
    });
    
  } catch (error: any) {
    console.error(`Error handling confirmed policy creation:`, error);
    if (policyIdToUseForEvents) {
      const finalPolicyIdForErrorEvent: Id<"policies"> = policyIdToUseForEvents;
      await ctx.db.insert("policyEvents", {
        policyConvexId: finalPolicyIdForErrorEvent,
        eventType: PolicyEventType.ERROR,
        data: {
          error: `Error handling confirmed policy creation: ${error.message}`,
          pendingTxId: pendingTx._id,
          transactionId: args.transactionId,
        },
        timestamp: Date.now(),
      });
    } else {
      console.error(`Could not record ERROR policyEvent for policy creation failure as policyConvexId is unavailable. PendingTxID: ${pendingTx._id}`);
    }
  }
}

/**
 * Handles follow-up actions when a policy activation transaction is confirmed.
 */
async function handleConfirmedPolicyActivation(ctx: MutationCtx, pendingTx: Doc<"pendingPolicyTransactions">, args: any): Promise<void> {
  console.log(`Handling confirmed policy activation for ${pendingTx._id}`);
  
  try {
    const policyId = pendingTx.payload.policyId || pendingTx.policyConvexId;
    
    if (!policyId) {
        throw new Error("Policy ID not found in pending transaction.");
    }
        
    const policy = await ctx.db.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found with ID: ${policyId}`);
    }
    
    await ctx.db.patch(policyId, {
      status: PolicyStatus.SETTLED,
      updatedAt: Date.now(),
      exercisedAt: Date.now(),
      settlementAmount: pendingTx.payload.settlementAmount,
      settlementPrice: pendingTx.payload.currentPrice,
    });
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: policyId,
      eventType: PolicyEventType.SETTLED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        settlementAmount: pendingTx.payload.settlementAmount,
        currentPrice: pendingTx.payload.currentPrice,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
    await ctx.db.insert("policyEvents", {
      policyConvexId: policyId,
      eventType: PolicyEventType.SETTLEMENT_REQUESTED,
      data: {
        pendingTxId: pendingTx._id,
        transactionId: args.transactionId,
        settlementAmount: pendingTx.payload.settlementAmount,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
    });
    
  } catch (error: any) {
    console.error(`Error handling confirmed policy activation:`, error);
    const policyIdForEvent = pendingTx.payload?.policyId || pendingTx.policyConvexId;
    if (policyIdForEvent) {
      await ctx.db.insert("policyEvents", {
        policyConvexId: policyIdForEvent,
        eventType: PolicyEventType.ERROR,
        data: {
          error: `Error handling confirmed policy activation: ${error.message}`,
          pendingTxId: pendingTx._id,
          transactionId: args.transactionId,
        },
        timestamp: Date.now(),
      });
    }
  }
}

/**
 * Updates the status of a pending policy transaction.
 */
export const updateTransactionStatus = internalMutation({
  args: {
    pendingTxId: v.id("pendingPolicyTransactions"),
    transactionId: v.optional(v.string()),
    status: v.string(), // New status (use TransactionStatus enum values)
    error: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log(`Updating transaction status for ${args.pendingTxId} to ${args.status}`);
    
    const pendingTx = await ctx.db.get(args.pendingTxId);
    if (!pendingTx) {
      throw new Error(`Pending transaction not found with ID: ${args.pendingTxId}`);
    }
    
    const currentStatus = pendingTx.status as TransactionStatus;
    const newStatus = args.status as TransactionStatus;
    
    const validTransitions: Record<TransactionStatus, TransactionStatus[]> = {
      [TransactionStatus.PENDING]: [TransactionStatus.SUBMITTED, TransactionStatus.FAILED, TransactionStatus.EXPIRED, TransactionStatus.REPLACED],
      [TransactionStatus.SUBMITTED]: [TransactionStatus.CONFIRMED, TransactionStatus.FAILED, TransactionStatus.REPLACED],
      [TransactionStatus.CONFIRMED]: [],
      [TransactionStatus.FAILED]: [TransactionStatus.REPLACED],
      [TransactionStatus.EXPIRED]: [TransactionStatus.REPLACED],
      [TransactionStatus.REPLACED]: [],
    };
    
    if (currentStatus === newStatus) {
      console.log(`Transaction ${args.pendingTxId} already has status ${newStatus}. No update needed.`);
      return pendingTx;
    }
    
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
    
    const updateData: any = {
      status: newStatus,
      updatedAt: Date.now(),
    };
    
    if (args.transactionId) updateData.transactionId = args.transactionId;
    if (args.error) updateData.error = args.error;
    if (args.data) updateData.resultData = args.data;
    
    await ctx.db.patch(args.pendingTxId, updateData);
    
    if (newStatus === TransactionStatus.CONFIRMED) {
      if (pendingTx.actionType === "Create") {
        await handleConfirmedPolicyCreation(ctx, pendingTx, args);
      } else if (pendingTx.actionType === "Activate") {
        await handleConfirmedPolicyActivation(ctx, pendingTx, args);
      } else if (pendingTx.actionType === "PremiumDistribution") {
        // Ensure policyId is correctly sourced for processPremiumDistributionEvent
        const policyIdForPremiumDist = pendingTx.payload?.policyId || pendingTx.policyConvexId;
        if (policyIdForPremiumDist) {
            // Updated path to premiumDistribution module
            await ctx.runMutation(internal.policyRegistry.premiumDistribution.processPremiumDistributionEvent, {
                policyId: policyIdForPremiumDist, 
                transactionId: args.transactionId,
                blockHeight: args.data?.blockHeight,
                // Pass other details if needed by the mutation, assuming they are in payload or data
                premium: pendingTx.payload?.premium, 
                counterparty: pendingTx.payload?.counterparty,
                settlementToken: pendingTx.payload?.settlementToken
            });
        } else {
            console.error(`[updateTransactionStatus] policyId missing for PremiumDistribution on pendingTxId: ${pendingTx._id}`);
        }
      }
    } else if (newStatus === TransactionStatus.FAILED) {
      console.error(`Transaction ${args.pendingTxId} failed: ${args.error || "No error details provided"}`);
      const policyIdForEvent = pendingTx.payload?.policyId || pendingTx.policyConvexId;
      if (policyIdForEvent) {
        await ctx.db.insert("policyEvents", {
          policyConvexId: policyIdForEvent,
          eventType: PolicyEventType.ERROR,
          data: {
            error: args.error || "Transaction failed",
            transactionId: args.transactionId,
            pendingTxId: args.pendingTxId,
          },
          timestamp: Date.now(),
        });
      }
    }
    
    return await ctx.db.get(args.pendingTxId);
  },
});

/**
 * Public mutation to update transaction status (e.g., from frontend after submission).
 */
export const updateTransactionStatusPublic = mutation({
  args: {
    pendingTxId: v.id("pendingPolicyTransactions"),
    transactionId: v.string(),
    status: v.string(), // Expecting values from TransactionStatus enum
  },
  handler: async (ctx, args): Promise<any> => {
    // Consider adding more validation here if needed before calling internal update
    // For now, directly update subset of fields. The internal 'updateTransactionStatus' handles complex logic.
    return await ctx.db.patch(args.pendingTxId, {
      transactionId: args.transactionId,
      status: args.status,
      updatedAt: Date.now(),
    });
  }
}); 
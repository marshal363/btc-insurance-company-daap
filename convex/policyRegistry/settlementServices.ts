import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api"; // For internal.policyRegistry.transactionManager.createPendingPolicyTransaction
import { PolicyStatus, PolicyType, PolicyEventType, TransactionStatus } from "./types";
import { mockGetLatestBlockHeight } from "./eligibilityChecks"; // Import from eligibilityChecks

// --- Helper Functions (specific to settlement or mocked here for now) ---

/**
 * Mock function to get a simulated current block height.
 * Replicated here if not imported from eligibilityChecks.ts to keep module self-contained for now.
 */
/*
async function mockGetLatestBlockHeight(): Promise<number> {
  return Math.floor(Date.now() / 10000) + 700000;
}
*/

/**
 * Helper function to calculate the settlement amount for a policy.
 */
function calculateSettlementAmount(
  policyType: PolicyType,
  protectedValue: number,
  protectionAmount: number,
  currentPrice: number
): number {
  if (policyType === PolicyType.PUT) {
    const priceDifference = protectedValue - currentPrice;
    if (priceDifference > 0) {
      const proportionLost = priceDifference / protectedValue;
      return Math.min(proportionLost * protectionAmount, protectionAmount);
    }
  } else if (policyType === PolicyType.CALL) {
    const priceDifference = currentPrice - protectedValue;
    if (priceDifference > 0) {
      const proportionGained = priceDifference / protectedValue;
      return Math.min(proportionGained * protectionAmount, protectionAmount);
    }
  }
  return 0;
}

/**
 * Mock function to prepare policy settlement transaction
 */
async function preparePolicySettlementTransaction(params: {
  policyId: Id<"policies">,
  owner: string, // This was implicitly assumed in the original, adding for clarity
  settlementAmount: number,
  currentPrice: number // This was implicitly assumed, adding for clarity
}) {
  console.log(`Preparing mock policy settlement transaction for policy ${params.policyId}`);
  return {
    txOptions: {
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      contractName: "policy-registry",
      functionName: "settle-policy",
      functionArgs: [params.policyId, params.settlementAmount, params.currentPrice],
      postConditions: [],
      network: "testnet", // Example value
    },
    txid: `mock-settle-tx-${Date.now()}`,
  };
}

// --- Settlement Service Functions ---

/**
 * Handle a policy activation (exercise) request.
 */
export const requestPolicySettlement = mutation({
  args: {
    policyId: v.id("policies"),
    currentPrice: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to settle a policy");
    }
    const owner = identity.tokenIdentifier;

    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy with ID ${args.policyId} not found`);
    }
    if (policy.owner !== owner) {
      throw new Error("Only the policy owner can settle the policy");
    }
    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new Error(`Policy must be active to settle (current status: ${policy.status})`);
    }

    const currentBlockHeight = await mockGetLatestBlockHeight();
    if (policy.expirationHeight < currentBlockHeight) {
      throw new Error(`Policy has expired at block ${policy.expirationHeight} (current: ${currentBlockHeight})`);
    }

    const settlementAmount = calculateSettlementAmount(
      policy.policyType as PolicyType,
      policy.protectedValue,
      policy.protectionAmount,
      args.currentPrice
    );

    if (settlementAmount <= 0) {
      throw new Error("Settlement amount is zero or negative, no settlement needed");
    }

    const settlementTx = await preparePolicySettlementTransaction({
      policyId: args.policyId,
      owner,
      settlementAmount,
      currentPrice: args.currentPrice,
    });

    const pendingTxId = await ctx.runMutation(internal.policyRegistry.transactionManager.createPendingPolicyTransaction, {
      actionType: "Settle",
      status: TransactionStatus.PENDING,
      payload: {
        policyId: args.policyId,
        owner,
        settlementAmount,
        currentPrice: args.currentPrice,
        transaction: settlementTx,
      },
      retryCount: 0, // Explicitly set, though createPendingPolicyTransaction might default it
      userId: owner,
      policyConvexId: args.policyId,
    });

    await ctx.runMutation(internal.policyRegistry.policyLifecycle.updatePolicyStatus, {
        policyId: args.policyId,
        newStatus: PolicyStatus.SETTLEMENT_IN_PROGRESS
    });

    return {
      pendingTxId,
      transaction: settlementTx.txOptions,
      settlementAmount,
    };
  },
});

/**
 * Update policy status to SETTLED and create settlement event.
 */
export const updatePolicyToSettled = internalMutation({
  args: {
    policyId: v.id("policies"),
    settlementAmount: v.number(),
    settlementTransactionId: v.string(),
    settlementBlockHeight: v.number(),
    settlementPrice: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.policyId, {
      status: PolicyStatus.SETTLED,
      updatedAt: Date.now(),
      settlementAmount: args.settlementAmount,
      settlementTransactionId: args.settlementTransactionId,
      settlementBlockHeight: args.settlementBlockHeight,
      settlementPrice: args.settlementPrice,
      // exercisedAt could also be set here if it implies the moment of settlement confirmation
      exercisedAt: Date.now(), 
    });

    // Updated call path to eventTracking module
    await ctx.runMutation(internal.policyRegistry.eventTracking.createPolicyEvent, {
      policyConvexId: args.policyId,
      eventType: PolicyEventType.SETTLED,
      data: {
        settlementAmount: args.settlementAmount,
        settlementTransactionId: args.settlementTransactionId,
        settlementBlockHeight: args.settlementBlockHeight,
        settlementPrice: args.settlementPrice,
      },
      timestamp: Date.now(),
      transactionId: args.settlementTransactionId,
      blockHeight: args.settlementBlockHeight,
    });

    return { success: true };
  },
}); 
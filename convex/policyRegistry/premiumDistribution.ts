import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { ActionCtx, MutationCtx } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { PolicyStatus, PolicyEventType, TokenType } from "./types";
import { mockNotifyLiquidityPoolOfPremiumDistribution } from "../mocks"; // Import the mock from its original location

/**
 * Internal action to initiate the premium distribution process for a given policy.
 * This would be called by a scheduled job (e.g., checkExpiredPoliciesJob).
 */
export const initiatePremiumDistributionForExpiredPolicy = internalAction({
  args: {
    policyId: v.id("policies"),
  },
  handler: async (ctx: ActionCtx, args: { policyId: Id<"policies"> }) => {
    console.log(`Initiating premium distribution check for expired policy: ${args.policyId}`);
    
    // In a real implementation, this would involve:
    // 1. Fetching the policy
    const policy = await ctx.runQuery(internal.policyRegistry.queries.getPolicy, { policyId: args.policyId });
    if (!policy) {
        console.error(`[PremiumDist] Policy ${args.policyId} not found.`);
        return;
    }
    // 2. Checking eligibility (e.g., status is EXPIRED, premiumDistributed is false)
    if (policy.status !== PolicyStatus.EXPIRED) {
        console.log(`[PremiumDist] Policy ${args.policyId} is not EXPIRED. Status: ${policy.status}. Skipping distribution.`);
        return;
    }
    if (policy.premiumDistributed) {
        console.log(`[PremiumDist] Premium for policy ${args.policyId} already distributed. Skipping.`);
        return;
    }

    // 3. Preparing and submitting the on-chain transaction (if required by the design)
    //    Or directly calling the mutation to process the distribution off-chain/notify LP
    console.log(`[PremiumDist] Triggering premium distribution processing for policy ${args.policyId}`);
    
    // Directly call the mutation that handles the distribution logic and LP notification
    // Pass necessary details from the policy
    await ctx.runMutation(internal.policyRegistry.premiumDistribution.processPremiumDistributionEvent, {
        policyId: args.policyId,
        // Pass potentially needed data if not re-fetched in mutation
        premium: policy.premium,
        counterparty: policy.counterparty,
        settlementToken: policy.settlementToken
    });

    // 4. Optionally, log an event indicating distribution was requested/initiated
    await ctx.runMutation(internal.policyRegistry.eventTracking.createPolicyEvent, {
      policyConvexId: args.policyId,
      eventType: PolicyEventType.PREMIUM_DISTRIBUTION_REQUESTED,
      data: { message: "Premium distribution initiated by system." },
      timestamp: Date.now(),
    });

  },
});

/**
 * Processes the premium distribution event, marks policy, and notifies Liquidity Pool.
 * This can be called directly by `initiatePremiumDistributionForExpiredPolicy` or potentially
 * by `updateTransactionStatus` if distribution were triggered by an on-chain event confirmation.
 */
export const processPremiumDistributionEvent = internalMutation({
  args: {
    policyId: v.id("policies"),
    transactionId: v.optional(v.string()), // Optional: On-chain transaction ID if applicable
    blockHeight: v.optional(v.number()),   // Optional: Block height if applicable
    // Pass necessary details if not refetching policy inside:
    premium: v.optional(v.number()),
    counterparty: v.optional(v.string()),
    settlementToken: v.optional(v.string()), // Expecting TokenType string
  },
  handler: async (ctx, args) => {
    const policy = await ctx.db.get(args.policyId);

    if (!policy) {
      console.error(`Policy not found with ID: ${args.policyId} during processPremiumDistributionEvent.`);
      return { success: false, reason: "Policy not found." };
    }

    if (policy.premiumDistributed) {
      console.log(`Premium already marked as distributed for policy ${args.policyId}. No action taken.`);
      return { success: true, reason: "Premium already distributed." };
    }

    // Mark premium as distributed in the policy document
    await ctx.db.patch(args.policyId, {
      premiumDistributed: true,
      updatedAt: Date.now(),
    });

    // Log the premium distributed event
    await ctx.runMutation(internal.policyRegistry.eventTracking.createPolicyEvent, {
      policyConvexId: args.policyId,
      eventType: PolicyEventType.PREMIUM_DISTRIBUTED,
      data: {
        message: "Premium successfully distributed to counterparty.",
        transactionId: args.transactionId,
        blockHeight: args.blockHeight,
        premiumAmount: args.premium ?? policy.premium, // Use passed or fetched premium
        counterparty: args.counterparty ?? policy.counterparty,
      },
      timestamp: Date.now(),
      transactionId: args.transactionId,
      blockHeight: args.blockHeight,
    });

    // Notify Liquidity Pool (using the imported mock)
    const counterpartyForLP = args.counterparty ?? policy.counterparty;
    const premiumForLP = args.premium ?? policy.premium;
    const tokenForLP = args.settlementToken ?? policy.settlementToken;

    if (counterpartyForLP && premiumForLP && tokenForLP) {
      await mockNotifyLiquidityPoolOfPremiumDistribution({
        policyId: args.policyId,
        premiumAmount: premiumForLP,
        distributedToCounterparty: counterpartyForLP,
        tokenId: tokenForLP as TokenType,
        distributionTxId: args.transactionId,
      });
    } else {
      console.warn(`[processPremiumDistributionEvent] Missing data on policy ${args.policyId} for LP notification.`);
    }

    console.log(`Premium distribution processed for policy ${args.policyId}.`);
    return { success: true };
  },
}); 
import { internalAction, internalMutation, ActionCtx, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { TransactionType, TransactionStatus, AllocationStatus, ProcessClaimSettlementResult } from "./types";
// import { logGenericPoolTransaction } from "./transactionManager"; // logGenericPoolTransaction is called via internal.liquidityPool.transactionManager

// --- Helper internalMutation to adjust provider capital after settlement ---
export const adjustProviderCapitalForSettlement = internalMutation({
  args: {
    provider: v.string(),
    token: v.string(),
    amountSettled: v.number(), // The amount of this provider's capital that was paid out
  },
  handler: async (ctx: MutationCtx, args) => {
    const balance = await ctx.db
      .query("provider_balances")
      .withIndex("by_provider_token", q => q.eq("provider", args.provider).eq("token", args.token))
      .unique();

    if (!balance) {
      console.error(`Provider balance not found for ${args.provider}, token ${args.token} during settlement adjustment.`);
      // This is a critical issue, implies inconsistency.
      // Depending on policy, might throw error or just log.
      return; // Or throw new Error(...)
    }

    // Reduce total_deposited by the amount that was actually paid out from this provider's capital
    // The locked_balance reduction for the original allocation is handled by releaseCollateral action.
    const newTotalDeposited = Math.max(0, (balance.total_deposited || 0) - args.amountSettled);

    await ctx.db.patch(balance._id, {
      total_deposited: newTotalDeposited,
      last_updated: Date.now(),
    });
    console.log(`Adjusted capital for provider ${args.provider} (token: ${args.token}) due to settlement. Amount settled: ${args.amountSettled}. New total_deposited: ${newTotalDeposited}`);
  },
});


// --- Processes a claim settlement after verification, adjusting provider capital ---
// This was formerly checkTransactionStatus in the main liquidityPool.ts
export const processClaimSettlement = internalAction({
  args: {
    // pendingTxConvexId: v.id("pending_pool_transactions"), // Removed as it was unused
    policyId: v.id("policies"),
    settlementAmountPaid: v.number(), // Total amount paid out by the LP Vault for this policy settlement
    settlementToken: v.string(),
    chainTxId: v.string(),      // On-chain transaction ID of the settlement payout
    blockHeight: v.number(),
    recipientAddress: v.string(), // Who received the settlement on-chain
    // Details of how much of each provider's collateral contributed to the settlement.
    providerContributions: v.array(
      v.object({
        provider: v.string(),
        amountSettledFromProvider: v.number(), // The portion of this provider's locked capital used for settlement
      })
    ),
  },
  handler: async (ctx: ActionCtx, args): Promise<ProcessClaimSettlementResult> => {
    console.log(`Processing claim settlement for policyId: ${args.policyId}, chainTxId: ${args.chainTxId}`);

    // 1. Log the settlement payout in pool_transactions
    const description = `Settlement paid for policy ${args.policyId} to ${args.recipientAddress}. Amount: ${args.settlementAmountPaid} ${args.settlementToken}.`;
    const loggedPoolTransactionId = await ctx.runMutation(internal.liquidityPool.transactionManager.logGenericPoolTransaction, {
      tx_id: `settlement-${args.policyId}-${args.chainTxId}`, // Ensure uniqueness
      tx_type: TransactionType.SETTLEMENT, 
      amount: args.settlementAmountPaid,
      token: args.settlementToken,
      status: TransactionStatus.CONFIRMED,
      chain_tx_id: args.chainTxId,
      policy_id: args.policyId,
      description: description,
      provider: "SYSTEM_SETTLEMENT", // Or derive if specific provider context makes sense
      timestamp: Date.now(), // Or use block timestamp if available and preferred
      metadata: { 
        recipientAddress: args.recipientAddress,
        blockHeight: args.blockHeight,
        providerContributions: args.providerContributions 
      }
    });

    // 2. Update provider_balances: reduce total_deposited for each contributing provider
    for (const contribution of args.providerContributions) {
      await ctx.runMutation(internal.liquidityPool.settlementProcessing.adjustProviderCapitalForSettlement, {
        provider: contribution.provider,
        token: args.settlementToken, // Assuming settlementToken is the same as collateral token here
        amountSettled: contribution.amountSettledFromProvider,
      });
    }

    // 3. Call releaseCollateral for the policy with reason EXERCISED.
    // This will update policy_allocations status to EXERCISED 
    // and reduce providers' locked_balances by their original allocation to this policy.
    try {
      await ctx.runAction(internal.liquidityPool.policyLifecycle.releaseCollateral, {
        policyId: args.policyId,
        reason: AllocationStatus.EXERCISED, // Use AllocationStatus enum value directly
      });
    } catch (error: any) {
      // If releaseCollateral fails (e.g., allocations already released), log it but continue
      // as the primary settlement accounting (capital reduction) is done.
      console.error(`Error during releaseCollateral for exercised policy ${args.policyId}: ${error.message}`);
      // This might indicate an inconsistent state if allocations weren't active before settlement.
    }

    // 4. Schedule pool metrics update
    await ctx.scheduler.runAfter(0, internal.liquidityPool.poolState.updatePoolMetrics, {
      token: args.settlementToken,
    });

    return {
      success: true,
      message: `Claim settlement processed successfully for policy ${args.policyId}.`,
      loggedPoolTransactionId
    };
  },
});


// --- Placeholder for verifyClaimSubmission ---
/**
 * Verifies a claim submission against on-chain data or other criteria.
 * This is an internal action, likely called by another process monitoring claims.
 *
 * Args:
 *   claimId: Id<"claims"> - The ID of the claim to verify.
 *   policyId: Id<"policies"> - The ID of the policy associated with the claim.
 *   // ... other relevant arguments for verification
 *
 * Returns:
 *   Promise<{ verificationStatus: string; details?:any } > - Result of the verification.
 */
// export const verifyClaimSubmission = internalAction({
//   args: {
//     claimId: v.id("claims"), // Assuming a 'claims' table
//     policyId: v.id("policies"),
//     // settlementAmount: v.optional(v.number()), // Example if amount is part of verification
//   },
//   handler: async (ctx: ActionCtx, args) => {
//     console.log(`Verifying claim submission for claimId: ${args.claimId}`);
//     // TODO: Implement actual claim verification logic.
//     // This might involve:
//     // 1. Fetching claim details from a 'claims' table.
//     // 2. Fetching policy details.
//     // 3. Potentially querying an oracle or external system for claim validation data.
//     // 4. Deciding if the claim is valid for settlement.
//
//     // Placeholder response
//     return { verificationStatus: "PENDING_CONFIRMATION" };
//   },
// });

export const verifyClaimSubmission = internalAction({
  args: {
    policyId: v.id("policies"),
    chainTxId: v.string(), // For logging and reference
    settlementAmountPaid: v.number(),
    settlementToken: v.string(),
    providerContributions: v.array(
      v.object({
        provider: v.string(),
        amountSettledFromProvider: v.number(),
      })
    ),
    // claimId: v.optional(v.id("claims")), // Optional: if claims have their own table/ID
  },
  handler: async (ctx: ActionCtx, args): Promise<{ verified: boolean; message: string; details?: any }> => {
    console.log(`Verifying settlement event for policy ${args.policyId}, chainTxId ${args.chainTxId}`);

    const allocations = await ctx.runQuery(internal.liquidityPool.policyLifecycle.getPolicyAllocations, {
      policyId: args.policyId,
    });

    if (!allocations || allocations.length === 0) {
      const msg = `No allocations found for policy ${args.policyId}. Cannot verify settlement event.`;
      console.error(msg);
      return { verified: false, message: msg };
    }

    // Check 1: Sum of contributions vs. settlementAmountPaid
    const totalContributed = args.providerContributions.reduce((sum, contrib) => sum + contrib.amountSettledFromProvider, 0);
    // Using a small tolerance for floating point comparisons, though these should be exact ideally
    if (Math.abs(totalContributed - args.settlementAmountPaid) > 0.000001) {
      const msg = `Sum of provider contributions (${totalContributed}) does not match settlementAmountPaid (${args.settlementAmountPaid}) for policy ${args.policyId}.`;
      console.error(msg);
      return { verified: false, message: msg, details: { totalContributed, settlementAmountPaid: args.settlementAmountPaid } };
    }

    // Check 2: Token consistency and individual contributions
    for (const contribution of args.providerContributions) {
      const matchingAllocation = allocations.find(alloc => alloc.provider === contribution.provider);
      if (!matchingAllocation) {
        const msg = `No matching allocation found for provider ${contribution.provider} in policy ${args.policyId}.`;
        console.error(msg);
        return { verified: false, message: msg, details: { provider: contribution.provider } };
      }

      if (matchingAllocation.token !== args.settlementToken) {
        const msg = `Settlement token (${args.settlementToken}) does not match allocation token (${matchingAllocation.token}) for provider ${contribution.provider}, policy ${args.policyId}.`;
        console.error(msg);
        return { verified: false, message: msg, details: { provider: contribution.provider, eventToken: args.settlementToken, allocToken: matchingAllocation.token } };
      }

      // A provider's contribution should not exceed their allocated amount for this policy.
      // This check assumes amountSettledFromProvider is the portion of *their* capital used.
      if (contribution.amountSettledFromProvider > matchingAllocation.amount) { // matchingAllocation.amount is allocated_amount
        const msg = `Provider ${contribution.provider}'s contribution (${contribution.amountSettledFromProvider}) exceeds their allocated amount (${matchingAllocation.amount}) for policy ${args.policyId}.`;
        console.error(msg);
        return { verified: false, message: msg, details: { provider: contribution.provider, contributed: contribution.amountSettledFromProvider, allocated: matchingAllocation.amount } };
      }
      
      // Ensure status implies it *could* be settled. An ACTIVE allocation is expected before it becomes EXERCISED.
      // If releaseCollateral has already run, status might be EXERCISED. This verification runs *before* processClaimSettlement.
      if (matchingAllocation.status !== AllocationStatus.ACTIVE) {
        // This might be too strict if events can be re-processed or if there's a state where it's EXERCISED but not yet fully processed off-chain.
        // However, for an initial verification based on an event that *triggers* settlement processing, ACTIVE is expected.
        console.warn(`Policy allocation for provider ${contribution.provider} on policy ${args.policyId} is not ACTIVE (Status: ${matchingAllocation.status}). This might be okay if reprocessing.`) 
      }
    }

    console.log(`Settlement event for policy ${args.policyId} verified successfully.`);
    return { verified: true, message: "Settlement event data is consistent." };
  },
});


// --- Placeholder for adjustProviderCapitalForSettlement ---
/**
 * Adjusts a single provider's capital due to a claim settlement.
 * This internal mutation updates the provider's balances.
 *
 * Args:
 *   provider: string - The provider's identifier.
 *   policyId: Id<"policies"> - The policy ID involved.
 *   settlementAmount: number - The amount this provider's capital is reduced by.
 *   token: string - The token of the capital.
 *   claimId: Id<"claims"> - The claim ID causing this adjustment.
 *
 * Returns:
 *   Promise<{ success: boolean; updatedBalanceId?: Id<"provider_balances"> }>
 */
// export const adjustProviderCapitalForSettlement = internalMutation({
//   args: {
//     provider: v.string(),
//     policyId: v.id("policies"),
//     settlementAmount: v.number(),
//     token: v.string(),
//     claimId: v.id("claims"), // For logging/metadata
//   },
//   handler: async (ctx: MutationCtx, args) => {
//     console.log(`Adjusting capital for provider ${args.provider} by ${args.settlementAmount} ${args.token} for policy ${args.policyId}`);
//
//     // TODO:
//     // 1. Fetch the provider's balance for the specified token.
//     //    const balance = await ctx.db.query("provider_balances")
//     //        .filter(q => q.eq(q.field("provider"), args.provider) && q.eq(q.field("token"), args.token))
//     //        .unique();
//     //    if (!balance) throw new Error(`Provider balance not found for ${args.provider}, token ${args.token}`);
//
//     // 2. Ensure the settlement amount does not exceed locked capital (or other relevant checks).
//     //    This assumes the `settlementAmount` here is the portion covered by this specific provider.
//     //    If `balance.locked_balance < args.settlementAmount`, this indicates an issue or prior miscalculation.
//
//     // 3. Decrease locked_balance by settlementAmount.
//     //    Decrease total_balance by settlementAmount. (Or handle this distinction based on how capital is tracked)
//     //    The key is that this capital is now paid out for a claim.
//     //    await ctx.db.patch(balance._id, {
//     //        locked_balance: Math.max(0, balance.locked_balance - args.settlementAmount),
//     //        // If total_balance includes locked_balance, it should also be reduced.
//     //        // total_balance: Math.max(0, balance.total_balance - args.settlementAmount),
//     //    });
//
//     // 4. Optionally, update the specific policy_allocation status for this provider to 'EXERCISED_PARTIAL' or 'EXERCISED_FULL'.
//     //    This might require fetching the allocation:
//     //    const allocation = await ctx.db.query("policy_allocations")
//     //        .filter(q => q.eq(q.field("policy_id"), args.policyId) && q.eq(q.field("provider"), args.provider))
//     //        .unique();
//     //    if (allocation) {
//     //        await ctx.db.patch(allocation._id, { status: AllocationStatus.EXERCISED /* or a more granular status */ });
//     //    }
//
//     // Placeholder response
//     // return { success: true, updatedBalanceId: balance._id };
//     return { success: true };
//   },
// }); 
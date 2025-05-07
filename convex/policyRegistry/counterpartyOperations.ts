import { query, mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { PolicyStatus, PolicyType, PositionType, TransactionStatus } from "./types";
import { determinePolicyPositionType } from "./policyLifecycle"; // Assuming this is where it will be or is

/**
 * Get income statistics for counterparty (Income Irene).
 * Aggregates policy data to provide insight on income, exposure, and distribution.
 * Corresponds to CV-PR-217.
 */
export const getCounterpartyIncomeStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated to get counterparty income stats.");
    }
    const counterparty = identity.tokenIdentifier;
    if (!counterparty) {
      throw new Error("Unable to determine user principal from identity.");
    }

    // Get all policies where user is counterparty
    const policies = await ctx.db
      .query("policies")
      .filter(q => q.eq(q.field("counterparty"), counterparty))
      .collect();

    // Default values for tokenBreakdown
    const tokenBreakdown: Record<string, {
      totalPolicies: number;
      activePolicies: number;
      earnedPremium: number;
      pendingPremium: number;
      activeExposure: number;
    }> = {};

    // Calculate aggregate statistics
    const stats = {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.status === PolicyStatus.ACTIVE).length,
      expiredPolicies: policies.filter(p => p.status === PolicyStatus.EXPIRED).length,
      exercisedPolicies: policies.filter(p => p.status === PolicyStatus.SETTLED).length,

      totalPremiumEarned: policies
        .filter(p => p.premiumDistributed)
        .reduce((sum, p) => sum + (p.premium ?? 0), 0), // Added nullish coalescing for premium

      pendingPremiums: policies
        .filter(p => p.status === PolicyStatus.EXPIRED && !p.premiumDistributed)
        .reduce((sum, p) => sum + (p.premium ?? 0), 0), // Added nullish coalescing for premium

      activeExposure: policies
        .filter(p => p.status === PolicyStatus.ACTIVE)
        .reduce((sum, p) => sum + (p.protectionAmount ?? 0), 0), // Added nullish coalescing for protectionAmount

      // Group by collateral token
      tokenBreakdown: policies.reduce((acc, policy) => {
        const token = policy.collateralToken;
        if (!acc[token]) {
          acc[token] = {
            totalPolicies: 0,
            activePolicies: 0,
            earnedPremium: 0,
            pendingPremium: 0,
            activeExposure: 0,
          };
        }

        acc[token].totalPolicies++;

        if (policy.status === PolicyStatus.ACTIVE) {
          acc[token].activePolicies++;
          acc[token].activeExposure += (policy.protectionAmount ?? 0); // Added nullish coalescing
        }

        if (policy.premiumDistributed) {
          acc[token].earnedPremium += (policy.premium ?? 0); // Added nullish coalescing
        } else if (policy.status === PolicyStatus.EXPIRED) {
          acc[token].pendingPremium += (policy.premium ?? 0); // Added nullish coalescing
        }

        return acc;
      }, tokenBreakdown),
    };

    return stats;
  },
});

/**
 * Prepares a mock transaction for policy acceptance by a counterparty.
 * This is a placeholder for real blockchain integration.
 * 
 * @param params Parameters for on-chain policy acceptance
 * @returns Prepared transaction object
 */
async function preparePolicyAcceptanceTransaction(params: {
  policyId: Id<"policies">;
  counterparty: string;
  positionType: PositionType;
  // Add other relevant params from the original preparePolicyCreationTransaction if needed for acceptance flow
}): Promise<any> {
  console.log("Preparing mock transaction for policy acceptance by counterparty:", params);
  
  // Mock transaction structure - this would need to be defined according to actual chain requirements
  return {
    txOptions: {
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", // Example contract address
      contractName: "policy-registry", // Example contract name
      functionName: "accept-policy-offer", // Example function name for acceptance
      functionArgs: [
        { type: "string-utf8", value: params.policyId }, // policy-id (assuming it's passed as a string ID or a trait reference)
        { type: "principal", value: params.counterparty }, // counterparty principal
        { type: "string-ascii", value: params.positionType }, // counterparty's position type
        // Potentially other arguments like collateral details if counterparty needs to lock them
      ],
      postConditions: [
        // Example: Ensure the policy status is updated or counterparty funds are locked if applicable
      ],
      fee: "5000", // Mock fee
      nonce: 0, // To be replaced
    }
  };
}

/**
 * Accept a policy offer as a counterparty.
 * Allows liquidity providers to accept pending policy offers.
 * Implements CV-PR-228.
 */
export const acceptPolicyOfferByCounterparty = mutation({
  args: {
    policyId: v.id("policies"),
  },
  handler: async (ctx: MutationCtx, args) => {
    // Get counterparty identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Counterparty must be authenticated to accept policy offers");
    }
    const counterparty = identity.tokenIdentifier;

    // Get the policy by ID
    const policy = await ctx.db.get(args.policyId);
    if (!policy) {
      throw new Error(`Policy with ID ${args.policyId} not found`);
    }

    // Verify the policy is in PENDING_COUNTERPARTY_ACCEPTANCE status
    if (policy.status !== PolicyStatus.PENDING_COUNTERPARTY_ACCEPTANCE) {
      throw new Error(`Policy is not in pending counterparty acceptance status (current: ${policy.status})`);
    }

    // If policy has a specified counterparty, verify it matches the current user
    if (policy.counterparty && policy.counterparty !== counterparty) {
      throw new Error("You are not the specified counterparty for this policy");
    }

    // Determine position type for counterparty (opposite of the policy owner's position)
    const counterpartyPositionType = determinePolicyPositionType(policy.policyType as PolicyType, false);

    // Prepare transaction for counterparty to accept policy
    const acceptTx = await preparePolicyAcceptanceTransaction({
      policyId: args.policyId,
      counterparty,
      positionType: counterpartyPositionType,
    });

    // Create pending transaction record
    // Note: The plan refers to internal.policyRegistry.transactionManager.createPendingPolicyTransaction
    // Ensure that path is correct and accessible if this line is uncommented/used.
    // For now, using ctx.db.insert directly as per original `acceptPolicyOfferByCounterparty`
    const pendingTxId = await ctx.db.insert("pendingPolicyTransactions", {
      actionType: "Accept",
      status: TransactionStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payload: {
        policyId: args.policyId,
        counterparty,
        positionType: counterpartyPositionType,
        transaction: acceptTx, // Storing the mock tx
      },
      retryCount: 0,
      userId: counterparty,
      policyConvexId: args.policyId, // Associate with policy
    });

    // Update policy status to indicate counterparty is processing acceptance
    await ctx.db.patch(args.policyId, {
      status: PolicyStatus.PENDING_COUNTERPARTY_SIGNATURE,
      updatedAt: Date.now(),
    });

    // Return transaction for counterparty to sign
    return {
      pendingTxId,
      transaction: acceptTx.txOptions,
      positionType: counterpartyPositionType,
    };
  },
}); 